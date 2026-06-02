import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

export function createRuntime({ context, workloadContext, timeoutMs }) {
  const generatedFiles = [];
  const childProcesses = [];

  function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      ...options
    });
    if (result.status !== 0) {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
      throw new Error(`${command} ${args.join(' ')} failed${output ? `\n${output}` : ''}`);
    }
    return result.stdout || '';
  }

  function commandSucceeds(command, args) {
    const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'ignore' });
    return result.status === 0;
  }

  function kubectl(args, options = {}) {
    return run('kubectl', ['--context', context, ...args], options);
  }

  function workloadKubectl(args, options = {}) {
    return run('kubectl', ['--context', workloadContext, ...args], options);
  }

  function helm(args, options = {}) {
    return run('helm', ['--kube-context', context, ...args], options);
  }

  function workloadHelm(args, options = {}) {
    return run('helm', ['--kube-context', workloadContext, ...args], options);
  }

  function writeGeneratedFile(name, content) {
    const filePath = path.join(os.tmpdir(), `${name}-${process.pid}-${Date.now()}`);
    fs.writeFileSync(filePath, content);
    generatedFiles.push(filePath);
    return filePath;
  }

  async function waitFor(name, fn) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
      try {
        const result = await fn();
        console.log(`ok ${name}`);
        return result;
      } catch (err) {
        lastError = err;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
    throw new Error(`${name} did not pass: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }

  async function startPortForward({ localPort, namespace, serviceName }) {
    const child = spawn('kubectl', [
      '--context',
      context,
      '-n',
      namespace,
      'port-forward',
      `svc/${serviceName}`,
      `${localPort}:8081`
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    childProcesses.push(child);
    child.stderr.on('data', (chunk) => {
      const line = chunk.toString();
      if (!line.includes('Forwarding from')) process.stderr.write(line);
    });
    await waitFor('control-plane port-forward readiness', async () => {
      await requestJson(`http://127.0.0.1:${localPort}`, 'GET', '/ready');
    });
  }

  function cleanupGeneratedFiles() {
    for (const child of childProcesses) {
      child.kill('SIGTERM');
    }
    for (const file of generatedFiles) {
      fs.rmSync(file, { force: true });
    }
  }

  return {
    cleanupGeneratedFiles,
    commandSucceeds,
    helm,
    kubectl,
    run,
    startPortForward,
    waitFor,
    workloadHelm,
    workloadKubectl,
    writeGeneratedFile
  };
}

export async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('Failed finding a free local port'));
      });
    });
    server.on('error', reject);
  });
}

export function requestJson(baseUrl, method, route, body, cookie) {
  return new Promise((resolve, reject) => {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
    const url = new URL(`${normalizedBaseUrl}${normalizedRoute}`);
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        method,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        headers: {
          ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
          ...(cookie ? { cookie } : {})
        },
        timeout: 10_000
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if ((res.statusCode || 0) < 200 || (res.statusCode || 0) >= 300) {
            reject(new Error(`${method} ${route} returned HTTP ${res.statusCode}: ${text.slice(0, 500)}`));
            return;
          }
          const parsed = text ? JSON.parse(text) : {};
          resolve({ body: parsed, headers: res.headers });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error(`${method} ${route} timed out`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}
