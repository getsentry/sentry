#`##GetSentry-Organization-Release.json
 - 2 commits
 - 1 file changed
 - 1 contributor
Commits on Aug 16, 2023
`Update organization-release.json`

`@MoneyMan573
MoneyMan573 committed 16 minutes ago
Merge branch 'getsentry:master' into organization-release.json`

`@MoneyMan573
MoneyMan573 committed 3 minutes ago
Showing  with 14 additions and 0 deletions.
 14 changes: 14 additions & 0 deletions14  
api-docs/components/schemas/releases/organization-release.json
@@ -1,3 +1,17 @@
`##User Auth Tokens
# Create New Token`
 - Auth Tokens are tied to the logged in user, meaning they'll stop working if the user leaves the organization! 
 - We suggest using internal integrations to create/manage tokens tied to the organization instead.
 - Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. 
 - They're the easiest way to get started using the API.
 - For more information on how to use the web API, see our documentation.
`AUTH TOKEN
89934216e1bdcb0e7d0ac4b122bf7ce1b972e06a7014d1edab0882e08ca3e4ea`
-----=
`SCOPES
event:admin, event:read, org:read, project:read, project:releases, alerts:read, event:write, member:read, org:admin, project:admin, team:admin, team:write, alerts:write, member:admin, member:write, org:integrations, org:write, project:write, team:read`
`CREATED
Aug 16, 11:42 PM`
{
  "OrganizationRelease": {
    "type": "object",
/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

import fs from 'fs';
import path from 'path';

import webpack from 'webpack';

type Options = {
  basePath: string;
};

class LastBuiltPlugin {
  basePath: string;
  isWatchMode: boolean;

  constructor({basePath}: Options) {
    this.basePath = basePath;
    this.isWatchMode = false;
  }

  apply(compiler: webpack.Compiler) {
    compiler.hooks.watchRun.tapAsync('LastBuiltPlugin', (_, callback) => {
      this.isWatchMode = true;
      callback();
    });

    compiler.hooks.done.tapAsync('LastBuiltPlugin', (_, callback) => {
      // If this is in watch mode, then assets will *NOT* be written to disk
      // We only want to record when we write to disk since this plugin is for
      // our acceptance test (which require assets to be on fs)
      if (this.isWatchMode) {
        callback();
        return;
      }

      fs.writeFile(
        path.join(this.basePath, '.webpack.meta'),
        JSON.stringify({
          // in seconds
          built: Math.floor(new Date(new Date().toUTCString()).getTime() / 1000),
        }),
        callback
      );
    });
  }
}

export default LastBuiltPlugin;
