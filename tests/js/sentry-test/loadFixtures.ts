/* global __dirname */
import fs from 'node:fs';
import path from 'node:path';

const FIXTURES_ROOT = path.join(__dirname, '../../../fixtures');

type Options = {
  /**
   * Flatten all fixtures to together into a single object
   */
  flatten?: boolean;
};

/**
 * Loads a directory of JSON fixtures.
 */
export function loadFixtures(dir: string, opts: Options = {}) {
  const from = path.join(FIXTURES_ROOT, dir);
  const files = fs.readdirSync(from);

  const fixtures: Record<string, any> = {};

  for (const file of files) {
    const filePath = path.join(from, file);

    if (/json$/.test(file)) {
      fixtures[file] = JSON.parse(fs.readFileSync(filePath).toString());
      continue;
    }

    throw new Error(`Invalid fixture type found: ${file}`);
  }

  if (opts.flatten) {
    const flattenedFixtures: Record<string, any> = {};

    for (const moduleKey in fixtures) {
      for (const moduleExport in fixtures[moduleKey]) {
        // Check if our flattenedFixtures already contains a key with the same export.
        // If it does, we want to throw and make sure that we dont silently override the fixtures.
        if (flattenedFixtures?.[moduleKey]?.[moduleExport]) {
          throw new Error(
            `Flatten will override ${flattenedFixtures[moduleKey]} with ${fixtures[moduleKey][moduleExport]}`
          );
        }

        flattenedFixtures[moduleExport] = fixtures[moduleKey][moduleExport];
      }
    }

    return flattenedFixtures;
  }

  return fixtures;
}
