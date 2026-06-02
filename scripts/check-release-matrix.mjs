import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const releaseVersion = process.env.ACORNOPS_RELEASE_VERSION || '0.0.1-experimental.1';
const chartPath = 'kubernetes/helm/acornops-platform';

const expectedImages = {
  managementConsole: `ghcr.io/acornops/management-console:${releaseVersion}`,
  controlPlane: `ghcr.io/acornops/control-plane:${releaseVersion}`,
  executionEngine: `ghcr.io/acornops/execution-engine:${releaseVersion}`,
  llmGateway: `ghcr.io/acornops/llm-gateway:${releaseVersion}`
};
const expectedPublishedImages = [
  ...Object.values(expectedImages),
  `ghcr.io/acornops/k8s-agent:${releaseVersion}`
];
const expectedPublishedCharts = [
  `oci://ghcr.io/acornops/charts/acornops-platform`,
  `oci://ghcr.io/acornops/charts/acornops-k8s-agent`
];

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function extractYamlString(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*"?([^"\\n]+)"?\\s*$`, 'm'));
  return match?.[1];
}

function stackBlock(content, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`^\\s{2}- name: ${escaped}\\n([\\s\\S]*?)(?=^\\s{2}- name: |^compatibility:|\\z)`, 'm'));
  return match?.[1] || '';
}

function componentLine(content, component) {
  const match = content.match(new RegExp(`^\\s{6}${component}:\\s*(\\S+)\\s*$`, 'm'));
  return match?.[1];
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} ${args.join(' ')} failed`);
  }
  return result.stdout;
}

function commandSucceeds(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'pipe' });
  return result.status === 0;
}

const stackVersions = read('release/stack-versions.yaml');
const chart = read(`${chartPath}/Chart.yaml`);
const compose = read('compose/vm-prod/compose.yaml');
const localStack = stackBlock(stackVersions, 'local-dev');
const vmProdStack = stackBlock(stackVersions, 'vm-prod-v1');
const k8sPlatformStack = stackBlock(stackVersions, 'k8s-platform-v1');

expect(extractYamlString(chart, 'version') === releaseVersion, `platform chart version should be ${releaseVersion}`);
expect(extractYamlString(chart, 'appVersion') === releaseVersion, `platform chart appVersion should be ${releaseVersion}`);

for (const [component, image] of Object.entries(expectedImages)) {
  expect(
    componentLine(vmProdStack, component) === image,
    `vm-prod-v1 should pin ${component} to ${image}`
  );
  expect(
    componentLine(k8sPlatformStack, component) === image,
    `k8s-platform-v1 should pin ${component} to ${image}`
  );
  expect(compose.includes(image), `VM compose fallback should pin ${component} image to ${image}`);
}

expect(
  componentLine(localStack, 'k8sAgent') === 'acornops/k8s-agent:local',
  'local-dev stack should keep k8sAgent local image metadata'
);
expect(
  stackVersions.includes('chartRef: oci://ghcr.io/acornops/charts/acornops-k8s-agent') === false,
  'release matrix should track component images only; agent chart refs belong in deployment values'
);

const rendered = run('helm', ['template', 'acornops', chartPath, '--namespace', 'acornops']);
for (const image of Object.values(expectedImages)) {
  expect(rendered.includes(`image: "${image}"`), `platform chart should render ${image}`);
}
expect(
  rendered.includes('AGENT_HELM_CHART_REF: "oci://ghcr.io/acornops/charts/acornops-k8s-agent"'),
  'platform chart should render the acornops-k8s-agent chart reference'
);

if (process.env.ACORNOPS_CHECK_PUBLISHED_ARTIFACTS === 'true') {
  for (const image of expectedPublishedImages) {
    expect(commandSucceeds('docker', ['manifest', 'inspect', image]), `published image should exist: ${image}`);
  }
  for (const chartRef of expectedPublishedCharts) {
    expect(
      commandSucceeds('helm', ['show', 'chart', chartRef, '--version', releaseVersion]),
      `published chart should exist: ${chartRef}:${releaseVersion}`
    );
  }
}

if (failures.length > 0) {
  console.error('Release matrix checks failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Release matrix checks passed for ${releaseVersion}.`);
