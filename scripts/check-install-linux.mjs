#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acornops-install-linux-'));
const binDir = path.join(tempDir, 'bin');
fs.mkdirSync(binDir);

for (const command of ['curl', 'sudo']) {
  fs.writeFileSync(path.join(binDir, command), '#!/usr/bin/env sh\nexit 0\n', { mode: 0o755 });
}

const result = spawnSync(path.join(repoRoot, 'scripts/install.sh'), {
  cwd: repoRoot,
  env: {
    ...process.env,
    AO_INSTALL_DRY_RUN: '1',
    AO_INSTALL_FORCE: '1',
    AO_INSTALL_OS: 'Linux',
    AO_INSTALL_SKIP_DOCTOR: '1',
    AO_LINUX_PACKAGE_MANAGER: 'apt-get',
    PATH: `${binDir}:${process.env.PATH ?? ''}`,
  },
  encoding: 'utf8',
});

const output = `${result.stdout}${result.stderr}`;

assert.equal(result.status, 0, output);
assert.match(output, /Installing curl/, output);
assert.match(output, /apt-get install -y curl/, output);
assert.match(output, /Installing Docker Engine/, output);
assert.match(output, /apt-get update/, output);
assert.match(output, /apt-get install -y docker\.io docker-compose-plugin/, output);
assert.match(output, /Installing kubectl/, output);
assert.match(output, /dl\.k8s\.io\/release/, output);
assert.match(output, /Installing k3d/, output);
assert.match(output, /k3d-io\/k3d\/main\/install\.sh/, output);
assert.match(output, /Skipping doctor validation/, output);

console.log('Linux install dry-run check passed.');
