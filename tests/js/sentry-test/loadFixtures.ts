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

const extensions = ['.js', '.ts', '.tsx', '.json'];

// This is a mapping of special cases where fixture name does not map 1:1 to file name.
// Some fixture files also contain more than one fixture so additional mappings are needed.
// If you have added new fixtures and you are seeing an error being throw, please add the fixture
const SPECIAL_MAPPING = {
  AllAuthenticators: 'authenticators.js',
  OrgRoleList: 'roleList.js',
  MetricsField: 'metrics.js',
  EventsStats: 'events.js',
  DetailedEvents: 'events.js',
  Events: 'events.js',
  OutcomesWithReason: 'outcomes.js',
  SentryAppComponentAsync: 'sentryAppComponent.js',
  EventStacktraceMessage: 'eventStacktraceException.js',
  MetricsTotalCountByReleaseIn24h: 'metrics.js',
  MetricsSessionUserCountByStatusByRelease: 'metrics.js',
  MOCK_RESP_VERBOSE: 'ruleConditions.js',
  SessionStatusCountByProjectInPeriod: 'sessions.js',
  SessionUserCountByStatusByRelease: 'sessions.js',
  SessionUserCountByStatus: 'sessions.js',
  SessionStatusCountByReleaseInPeriod: 'sessions.js',
  SessionsField: 'sessions.js',
  ProviderList: 'integrationListDirectory.js',
  BitbucketIntegrationConfig: 'integrationListDirectory.js',
  GitHubIntegration: 'githubIntegration.js',
  GitHubRepositoryProvider: 'githubRepositoryProvider.js',
  GitHubIntegrationProvider: 'githubIntegrationProvider.js',
  GitHubIntegrationConfig: 'integrationListDirectory.js',
  OrgOwnedApps: 'integrationListDirectory.js',
  PublishedApps: 'integrationListDirectory.js',
  SentryAppInstalls: 'integrationListDirectory.js',
  PluginListConfig: 'integrationListDirectory.js',
  DiscoverSavedQuery: 'discover.js',
  VercelProvider: 'vercelIntegration.js',
  TagValues: 'tagvalues.js',
};

function tryRequire(dir: string, name: string): any {
  if (SPECIAL_MAPPING[name]) {
    return require(path.resolve(dir, SPECIAL_MAPPING[name]));
  }
  for (const ext of extensions) {
    try {
      return require(path.resolve(dir, lowercaseFirst(name) + ext));
    } catch {
      // ignore
    }
  }
  throw new Error('Failed to resolve file');
}

function lowercaseFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
export function makeLazyFixtures<UserProvidedFixtures extends Record<any, any>>(
  fixturesDirectoryPath: string,
  userProvidedFixtures: UserProvidedFixtures
): TestStubFixtures & UserProvidedFixtures {
  const lazyFixtures = new Proxy(
    {},
    {
      get(target, prop: string) {
        if (target[prop]) {
          return target[prop];
        }
        if (userProvidedFixtures[prop]) {
          return userProvidedFixtures[prop];
        }

        try {
          const maybeModule = tryRequire(fixturesDirectoryPath, prop);
          for (const exportKey in maybeModule) {
            target[exportKey] = maybeModule[exportKey];
          }
        } catch {
          // ignore
        }

        if (target[prop] === undefined) {
          return () => {
            throw new Error(
              `Failed to resolve ${prop} fixture. \n
              - Your fixture does not map directly to file on disk or fixture file could be exporting > 1 fixture. \n
              - To resolve this, add a mapping to SPECIAL_MAPPING in loadFixtures.ts or ensure fixture export name maps to the file on disk. \n
              - If you are seeing this only in CI and you have followed the step above, check the exact casing of the file as it is case sensitive.`
            );
          };
        }
        return target[prop];
      },
    }
  );

  return lazyFixtures as TestStubFixtures & UserProvidedFixtures;
}
