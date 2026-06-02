import http from 'node:http';
import https from 'node:https';

const DEFAULTS = {
  edgeUrl: 'http://127.0.0.1:8088',
  consoleHost: 'console.acornops.localhost',
  platformHost: 'acornops.localhost',
  controlPlaneHost: 'control-plane.acornops.localhost',
  executionEngineHost: 'execution-engine.acornops.localhost',
  llmGatewayHost: 'llm-gateway.acornops.localhost',
  timeoutMs: 120_000,
  intervalMs: 2_000
};

function env(name, fallback) {
  return process.env[name] || fallback;
}

const config = {
  edgeUrl: normalizeBaseUrl(env('ACORNOPS_SMOKE_EDGE_URL', DEFAULTS.edgeUrl)),
  consoleHost: env('ACORNOPS_SMOKE_CONSOLE_HOST', DEFAULTS.consoleHost),
  platformHost: env('ACORNOPS_SMOKE_PLATFORM_HOST', DEFAULTS.platformHost),
  controlPlaneHost: env('ACORNOPS_SMOKE_CONTROL_PLANE_HOST', DEFAULTS.controlPlaneHost),
  executionEngineHost: env('ACORNOPS_SMOKE_EXECUTION_ENGINE_HOST', DEFAULTS.executionEngineHost),
  llmGatewayHost: env('ACORNOPS_SMOKE_LLM_GATEWAY_HOST', DEFAULTS.llmGatewayHost),
  timeoutMs: Number(env('ACORNOPS_SMOKE_TIMEOUT_MS', String(DEFAULTS.timeoutMs))),
  intervalMs: Number(env('ACORNOPS_SMOKE_INTERVAL_MS', String(DEFAULTS.intervalMs))),
  allowNonLocal: env('ACORNOPS_SMOKE_ALLOW_NON_LOCAL', 'false') === 'true'
};

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function joinUrl(baseUrl, path) {
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function isLocalUrl(value) {
  const url = new URL(value);
  return isLocalHost(url.hostname);
}

function isLocalHost(value) {
  const trimmed = value.trim();
  const bracketedIpv6 = /^\[(.*)\](?::\d+)?$/.exec(trimmed);
  const hostname = bracketedIpv6
    ? bracketedIpv6[1]
    : trimmed.includes(':') && trimmed.indexOf(':') === trimmed.lastIndexOf(':')
      ? trimmed.split(':')[0]
      : trimmed;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

function assertLocalOnly() {
  if (config.allowNonLocal) return;
  if (!isLocalUrl(config.edgeUrl)) {
    throw new Error('ACORNOPS_SMOKE_EDGE_URL must point at localhost for local smoke tests. Set ACORNOPS_SMOKE_ALLOW_NON_LOCAL=true to override deliberately.');
  }
  for (const [name, value] of Object.entries({
    ACORNOPS_SMOKE_CONSOLE_HOST: config.consoleHost,
    ACORNOPS_SMOKE_PLATFORM_HOST: config.platformHost,
    ACORNOPS_SMOKE_CONTROL_PLANE_HOST: config.controlPlaneHost,
    ACORNOPS_SMOKE_EXECUTION_ENGINE_HOST: config.executionEngineHost,
    ACORNOPS_SMOKE_LLM_GATEWAY_HOST: config.llmGatewayHost
  })) {
    if (!isLocalHost(value)) {
      throw new Error(`${name} must point at localhost for local smoke tests. Set ACORNOPS_SMOKE_ALLOW_NON_LOCAL=true to override deliberately.`);
    }
  }
}

function request(name, host, path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = joinUrl(config.edgeUrl, path);
    const target = new URL(url);
    const client = target.protocol === 'https:' ? https : http;
    const requestOptions = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method: options.method || 'GET',
      headers: { ...options.headers, Host: host },
      timeout: 10_000
    };

    const req = client.request(requestOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const response = {
          status: res.statusCode || 0,
          headers: {
            get(headerName) {
              const value = res.headers[headerName.toLowerCase()];
              if (Array.isArray(value)) return value.join(', ');
              return value || null;
            }
          }
        };
        const expectedStatuses = options.expectedStatuses || [200];
        if (!expectedStatuses.includes(response.status)) {
          reject(new Error(`${name} returned HTTP ${response.status}; body: ${text.slice(0, 500)}`));
          return;
        }
        resolve({ response, text });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`${name} timed out after 10000ms`));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function parseJson(name, text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${name} did not return valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function waitFor(name, check) {
  const deadline = Date.now() + config.timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      console.log(`ok ${name}`);
      return result;
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, config.intervalMs));
    }
  }
  throw new Error(`${name} did not pass within ${config.timeoutMs}ms: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} response must be an object`);
  }
  return value;
}

function requireArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} response must be an array`);
  }
  return value;
}

function requireListItems(value, name) {
  if (Array.isArray(value)) return value;
  const payload = requireObject(value, name);
  if (!Array.isArray(payload.items)) {
    throw new Error(`${name} response must be an array or an object with an items array`);
  }
  return payload.items;
}

function firstArrayField(value, fields, name) {
  const payload = requireObject(value, name);
  for (const field of fields) {
    if (Array.isArray(payload[field])) return payload[field];
  }
  throw new Error(`${name} response missing expected array field: ${fields.join(', ')}`);
}

function requireReadyStatus(payload, name) {
  if (payload.status && !['ok', 'ready'].includes(payload.status)) {
    throw new Error(`${name} status is ${payload.status}`);
  }
}

function getSessionCookie(response) {
  const raw = response.headers.get('set-cookie');
  if (!raw) throw new Error('dev-login did not set a session cookie');
  return raw.split(';')[0];
}

function getNamedCookie(response, cookieName) {
  const raw = response.headers.get('set-cookie');
  if (!raw) throw new Error(`${cookieName} cookie was not set`);
  const cookies = raw.split(/,\s*(?=[^;,]+=)/);
  const cookie = cookies.find((item) => item.startsWith(`${cookieName}=`));
  if (!cookie) throw new Error(`${cookieName} cookie was not set`);
  return cookie.split(';')[0];
}

assertLocalOnly();

console.log('Running local AcornOps full-stack smoke...');
console.log(`edge: ${config.edgeUrl}`);
console.log(`console host: ${config.consoleHost}`);
console.log(`platform host: ${config.platformHost}`);

await waitFor('management console root', async () => {
  const { response, text } = await request('management console root', config.consoleHost, '/');
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) throw new Error(`expected HTML, got ${contentType}`);
  if (!text.includes('<div id="root"') && !text.includes('/src/')) {
    throw new Error('console HTML does not look like the management console app shell');
  }
});

await waitFor('management console deep link', async () => {
  const { text } = await request(
    'management console deep link',
    config.consoleHost,
    '/workspaces/smoke-workspace/kubernetes-clusters/smoke-cluster/resources'
  );
  if (!text.includes('<div id="root"') && !text.includes('/src/')) {
    throw new Error('console deep link did not return the app shell');
  }
});

await waitFor('control-plane readiness', async () => {
  const { text } = await request('control-plane readiness', config.controlPlaneHost, '/ready');
  const payload = requireObject(parseJson('control-plane readiness', text), 'control-plane readiness');
  requireReadyStatus(payload, 'control-plane readiness');
});

await waitFor('llm-gateway readiness', async () => {
  const { text } = await request('llm-gateway readiness', config.llmGatewayHost, '/ready');
  const payload = requireObject(parseJson('llm-gateway readiness', text), 'llm-gateway readiness');
  requireReadyStatus(payload, 'llm-gateway readiness');
});

await waitFor('execution-engine readiness', async () => {
  const { text } = await request('execution-engine readiness', config.executionEngineHost, '/ready');
  const payload = requireObject(parseJson('execution-engine readiness', text), 'execution-engine readiness');
  requireReadyStatus(payload, 'execution-engine readiness');
});

await waitFor('public API host JWKS route', async () => {
  const { text } = await request('public API host JWKS route', config.platformHost, '/api/v1/auth/jwks.json');
  const payload = requireObject(parseJson('public API host JWKS route', text), 'public API host JWKS route');
  if (!Array.isArray(payload.keys)) throw new Error('JWKS response missing keys array');
});

const cookie = await waitFor('same-origin dev login', async () => {
  const { response, text } = await request('same-origin dev login', config.consoleHost, '/api/v1/auth/dev-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'dev@acornops.local', name: 'Dev User' })
  });
  const payload = requireObject(parseJson('same-origin dev login', text), 'same-origin dev login');
  if (!payload.user || typeof payload.user !== 'object') throw new Error('dev-login response missing user');
  return getSessionCookie(response);
});

const csrf = await waitFor('same-origin csrf token', async () => {
  const { response, text } = await request('same-origin csrf token', config.consoleHost, '/api/v1/auth/csrf', {
    headers: { cookie }
  });
  const payload = requireObject(parseJson('same-origin csrf token', text), 'same-origin csrf token');
  if (typeof payload.csrfToken !== 'string' || payload.csrfToken.length === 0) {
    throw new Error('CSRF response missing csrfToken');
  }
  return {
    cookie: `${cookie}; ${getNamedCookie(response, 'acornops_cp_csrf')}`,
    token: payload.csrfToken
  };
});

await waitFor('same-origin authenticated me', async () => {
  const { text } = await request('same-origin authenticated me', config.consoleHost, '/api/v1/me', {
    headers: { cookie }
  });
  const payload = requireObject(parseJson('same-origin authenticated me', text), 'same-origin authenticated me');
  if (!payload.id) throw new Error('/me response missing user id');
});

const workspace = await waitFor('workspace list', async () => {
  const { text } = await request('workspace list', config.consoleHost, '/api/v1/workspaces', {
    headers: { cookie }
  });
  const workspaces = requireListItems(parseJson('workspace list', text), 'workspace list');
  if (workspaces.length === 0) throw new Error('expected at least one workspace from development seed');
  return workspaces.find((item) => item.name === 'Demo Workspace') || workspaces[0];
});

const cluster = await waitFor('cluster list', async () => {
  const { text } = await request('cluster list', config.consoleHost, `/api/v1/workspaces/${workspace.id}/kubernetes-clusters`, {
    headers: { cookie }
  });
  const clusters = requireListItems(parseJson('cluster list', text), 'cluster list');
  if (clusters.length === 0) throw new Error('expected at least one cluster from development seed');
  return clusters.find((item) => item.name === 'Demo Cluster') || clusters[0];
});

await waitFor('cluster detail', async () => {
  const { text } = await request(
    'cluster detail',
    config.consoleHost,
    `/api/v1/workspaces/${workspace.id}/kubernetes-clusters/${cluster.id}`,
    { headers: { cookie } }
  );
  const payload = requireObject(parseJson('cluster detail', text), 'cluster detail');
  if (payload.id !== cluster.id) throw new Error('cluster detail id does not match listed cluster');
});

const vm = await waitFor('virtual machine list', async () => {
  const { text } = await request(
    'virtual machine list',
    config.consoleHost,
    `/api/v1/workspaces/${workspace.id}/virtual-machines`,
    { headers: { cookie } }
  );
  const virtualMachines = requireListItems(parseJson('virtual machine list', text), 'virtual machine list');
  if (virtualMachines.length === 0) throw new Error('expected at least one VM from development seed');
  return virtualMachines.find((item) => item.name === 'Development Linux VM') || virtualMachines[0];
});

await waitFor('virtual machine detail online', async () => {
  const { text } = await request(
    'virtual machine detail',
    config.consoleHost,
    `/api/v1/workspaces/${workspace.id}/virtual-machines/${vm.id}`,
    { headers: { cookie } }
  );
  const payload = requireObject(parseJson('virtual machine detail', text), 'virtual machine detail');
  if (payload.id !== vm.id) throw new Error('VM detail id does not match listed VM');
  if (payload.status !== 'online') throw new Error(`VM is ${payload.status}; expected online`);
});

await waitFor('virtual machine resources', async () => {
  const { text } = await request(
    'virtual machine resources',
    config.consoleHost,
    `/api/v1/workspaces/${workspace.id}/virtual-machines/${vm.id}/resources`,
    { headers: { cookie } }
  );
  const resources = requireListItems(parseJson('virtual machine resources', text), 'virtual machine resources');
  if (resources.length === 0) throw new Error('VM resources are empty');
});

await waitFor('virtual machine findings', async () => {
  const { text } = await request(
    'virtual machine findings',
    config.consoleHost,
    `/api/v1/workspaces/${workspace.id}/virtual-machines/${vm.id}/findings`,
    { headers: { cookie } }
  );
  const findings = requireListItems(parseJson('virtual machine findings', text), 'virtual machine findings');
  if (findings.length === 0) throw new Error('VM findings are empty');
});

await waitFor('virtual machine metrics', async () => {
  const { text } = await request(
    'virtual machine metrics',
    config.consoleHost,
    `/api/v1/workspaces/${workspace.id}/virtual-machines/${vm.id}/metrics/history`,
    { headers: { cookie } }
  );
  const metrics = firstArrayField(parseJson('virtual machine metrics', text), ['points', 'items'], 'virtual machine metrics');
  if (metrics.length === 0) throw new Error('VM metrics are empty');
});

await waitFor('virtual machine logs', async () => {
  const { text } = await request(
    'virtual machine logs',
    config.consoleHost,
    `/api/v1/workspaces/${workspace.id}/virtual-machines/${vm.id}/logs?source=journald&limit=20`,
    { headers: { cookie } }
  );
  const logs = firstArrayField(parseJson('virtual machine logs', text), ['entries', 'items'], 'virtual machine logs');
  if (logs.length === 0) throw new Error('VM logs are empty');
});

await waitFor('virtual machine MCP servers', async () => {
  const { text } = await request(
    'virtual machine MCP servers',
    config.consoleHost,
    `/api/v1/workspaces/${workspace.id}/targets/${vm.id}/mcp/servers`,
    { headers: { cookie } }
  );
  const servers = requireListItems(parseJson('virtual machine MCP servers', text), 'virtual machine MCP servers');
  if (servers.length === 0) throw new Error('expected VM MCP server registrations');
});

const vmSession = await waitFor('virtual machine troubleshooting session', async () => {
  const { text } = await request(
    'virtual machine troubleshooting session',
    config.consoleHost,
    `/api/v1/workspaces/${workspace.id}/targets/${vm.id}/sessions`,
    {
      method: 'POST',
      headers: { cookie: csrf.cookie, 'content-type': 'application/json', 'x-csrf-token': csrf.token },
      expectedStatuses: [201],
      body: JSON.stringify({ title: 'VM smoke troubleshooting' })
    }
  );
  const payload = requireObject(parseJson('virtual machine troubleshooting session', text), 'virtual machine troubleshooting session');
  if (!payload.id) throw new Error('VM session response missing id');
  return payload;
});

const vmRun = await waitFor('virtual machine troubleshooting run dispatch', async () => {
  const { text } = await request(
    'virtual machine troubleshooting message',
    config.consoleHost,
    `/api/v1/sessions/${vmSession.id}/messages`,
    {
      method: 'POST',
      headers: { cookie: csrf.cookie, 'content-type': 'application/json', 'x-csrf-token': csrf.token },
      expectedStatuses: [202],
      body: JSON.stringify({
        content: 'Use read-only VM tools to summarize host health.',
        toolAccessMode: 'read_only',
        clientMessageId: 'local-smoke-vm-health'
      })
    }
  );
  const payload = requireObject(parseJson('virtual machine troubleshooting message', text), 'virtual machine troubleshooting message');
  if (!payload.run_id) throw new Error('VM troubleshooting message response missing run_id');
  return payload;
});

await waitFor('virtual machine troubleshooting run completed with tool call', async () => {
  const { text } = await request('virtual machine troubleshooting run', config.consoleHost, `/api/v1/runs/${vmRun.run_id}`, {
    headers: { cookie }
  });
  const payload = requireObject(parseJson('virtual machine troubleshooting run', text), 'virtual machine troubleshooting run');
  if (payload.targetType !== 'virtual_machine') throw new Error(`VM run targetType is ${payload.targetType}`);
  if (payload.toolAccessMode !== 'read_only') throw new Error(`VM run toolAccessMode is ${payload.toolAccessMode}`);
  if (payload.status !== 'completed') {
    throw new Error(`VM run is ${payload.status}; expected completed`);
  }
  const usage = payload.usage && typeof payload.usage === 'object' ? payload.usage : {};
  if (Number(usage.tool_calls || 0) < 1) {
    throw new Error('VM run completed without a recorded tool call');
  }
});

console.log('Local AcornOps full-stack smoke passed.');
