/* global __dirname */
/* eslint import/no-nodejs-modules:0 */

import fs from 'fs';
import path from 'path';

import TestStubFixtures from '../../../fixtures/js-stubs/types';

const FIXTURES_ROOT = path.join(__dirname, '../../../fixtures');

type Options = {
  /**
   * Flatten all fixtures to together into a single object
   */
  flatten?: boolean;
};

/**
 * Loads a directory of fixtures. Supports js and json fixtures.
 */
export function loadFixtures(dir: string, opts: Options = {}): TestStubFixtures {
  const from = path.join(FIXTURES_ROOT, dir);
  const files = fs.readdirSync(from);

  // @ts-ignore, this is a partial definition
  const fixtures: TestStubFixtures = {};

  for (const file of files) {
    const filePath = path.join(from, file);

    if (/[jt]sx?$/.test(file)) {
      const module = require(filePath);

      if (module.default) {
        throw new Error('Javascript fixtures cannot use default export');
      }

      fixtures[file] = module;
      continue;
    }
    if (/json$/.test(file)) {
      fixtures[file] = JSON.parse(fs.readFileSync(filePath).toString());
      continue;
    }

    throw new Error(`Invalid fixture type found: ${file}`);
  }

  if (opts.flatten) {
    // @ts-ignore, this is a partial definition
    const flattenedFixtures: TestStubFixtures = {};

    for (const moduleKey in fixtures) {
      for (const moduleExport in fixtures[moduleKey]) {
        // Check if our flattenedFixtures already contains a key with the same export.
        // If it does, we want to throw and make sure that we dont silently override the fixtures.
        if (flattenedFixtures?.[moduleKey]?.[moduleExport]) {
          throw new Error(
            `Flatten will override module ${flattenedFixtures[moduleKey]} with ${fixtures[moduleKey][moduleExport]}`
          );
        }

        flattenedFixtures[moduleExport] = fixtures[moduleKey][moduleExport];
      }
    }

    return flattenedFixtures;
  }

  return fixtures;
}
