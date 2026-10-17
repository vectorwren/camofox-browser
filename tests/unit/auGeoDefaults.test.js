import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// The fork's AU egress-coherent default block lives inline in server.js (same
// placement as the original bb3ad7c patch). These tests pin the CONTRACT on
// the source: applied only to proxyless sessions, after the identity spread,
// env-overridable, geolocation permission granted, exact Sydney coordinates.
const serverPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'server.js');
const src = readFileSync(serverPath, 'utf8');
const BLOCK = String.raw`if (!CONFIG.proxy.host) {
        contextOptions.locale = process.env.CAMOFOX_DEFAULT_LOCALE || 'en-AU';
        contextOptions.timezoneId = process.env.CAMOFOX_DEFAULT_TZ || 'Australia/Sydney';
        const lat = parseFloat(process.env.CAMOFOX_DEFAULT_LAT || '-33.8688');
        const lon = parseFloat(process.env.CAMOFOX_DEFAULT_LON || '151.2093');
        contextOptions.geolocation = { latitude: lat, longitude: lon };
        contextOptions.permissions = contextOptions.permissions || ['geolocation'];
      }`;
describe('fork AU egress-coherent defaults (server.js source contract)', () => {
  test('applies the AU defaults block only when no proxy is configured', () => {
    expect(src).toContain("if (!CONFIG.proxy.host) {\n        contextOptions.locale");
  });
  test('guards the exact env-overridable defaults (locale/tz/lat/lon)', () => {
    for (const envName of [
      'CAMOFOX_DEFAULT_LOCALE',
      'CAMOFOX_DEFAULT_TZ',
      'CAMOFOX_DEFAULT_LAT',
      'CAMOFOX_DEFAULT_LON',
    ]) {
      expect(src).toContain(`process.env.${envName} ||`);
    }
    expect(src).toContain("'en-AU'");
    expect(src).toContain("'Australia/Sydney'");
    expect(src).toContain("'-33.8688'");
    expect(src).toContain("'151.2093'");
  });
  test('grants the geolocation permission (Playwright requires it for the API)', () => {
    expect(src).toContain("contextOptions.permissions = contextOptions.permissions || ['geolocation']");
  });
  test('block sits AFTER the identity spread inside getSession (post-v1.18.1 refactor placement)', () => {
    const spreadIdx = src.indexOf('...contextIdentityOptions({');
    const blockIdx = src.indexOf(BLOCK.split('\n')[0]);
    expect(spreadIdx).toBeGreaterThan(-1);
    expect(blockIdx).toBeGreaterThan(spreadIdx);
  });
  test('proxyless guard still delegates GeoIP identity to Camoufox when a proxy exists', () => {
    // the spread (upstream) handles proxy sessions; the fork block must be the
    // ONLY place contextOptions.locale is assigned outside lib/browser-identity
    const assigns = src.match(/contextOptions\.locale\s*=/g) || [];
    expect(assigns.length).toBe(1);
  });
});
