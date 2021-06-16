/* global __dirname */
/* eslint import/no-nodejs-modules:0 */
import fs from 'fs';
import path from 'path';

const FIXTURES_ROOT = path.join(__dirname, '../../fixtures');

type Options = {
  /**
   * Flatten all fixtures to together into a single object
   */
  flatten?: boolean;
};

/**
 * Loads a directory of fixtures. Supports js and json fixtures.
 */
export function loadFixtures(dir: string, opts: Options = {}) {
  const from = path.join(FIXTURES_ROOT, dir);
  const files = fs.readdirSync(from);

  const fixturesPairs = files.map(file => {
    const filePath = path.join(from, file);

    if (/[jt]sx?$/.test(file)) {
      const module = require(filePath);

      if (Object.keys(module).includes('default')) {
        throw new Error('Javascript fixtures cannot use default export');
      }

      return [file, module] as const;
    }

    if (/json$/.test(file)) {
      return [file, JSON.parse(fs.readFileSync(filePath).toString())] as const;
    }

    throw new Error(`Invalid fixture type found: ${file}`);
  });

  const fixtures = Object.fromEntries(fixturesPairs);

  if (opts.flatten) {
    return Object.values(fixtures).reduce((acc, val) => ({...acc, ...val}), {});
  }

  return fixtures;
}
