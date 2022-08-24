import {MDXProvider} from '@mdx-js/react';

import Alert from 'sentry/components/alert';

import AuthDocs from './auth.mdx';
import PaginationDocs from './pagination.mdx';
import PermissionsDocs from './permissions.mdx';
import RateLimitDocs from './ratelimits.mdx';
import RequestsDocs from './requests.mdx';

// ^-- Assumes an integration is used to compile MDX to JS, such as
// `@mdx-js/esbuild`, `@mdx-js/loader`, `@mdx-js/node-loader`, or
// `@mdx-js/rollup`, and that it is configured with
// `options.providerImportSource: '@mdx-js/react'`.

export enum Docs {
  Auth = 'Authentication',
  Pagination = 'Paginating Results',
  Permissions = 'Permissions & Scopes',
  RateLimits = 'Rate Limits',
  Request = 'Requests',
}

export interface Props {
  docName: Docs | undefined;
}

const components = {
  Alert,
};

const DocsSelector = ({docName}: Props) => {
  return (
    <MDXProvider components={components}>
      {docName === Docs.Auth && <AuthDocs components={components} />}
      {docName === Docs.Pagination && <PaginationDocs components={components} />}
      {docName === Docs.Permissions && <PermissionsDocs components={components} />}
      {docName === Docs.RateLimits && <RateLimitDocs components={components} />}
      {docName === Docs.Request && <RequestsDocs components={components} />}
    </MDXProvider>
  );
};

export default DocsSelector;
