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
  HighlightCode: () => JSX.Element;
  docName: Docs | undefined;
}

const Table = ({headers, data}: {data: string[][]; headers: string[]}) => {
  return (
    <table className="docs-table">
      <thead>
        <tr>
          {headers.map((header, idx) => (
            <th key={header || idx} align="center">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map(row => (
          <tr key={row[0]}>
            {row.map(col => (
              <td key={col} align="center">
                {col}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const DocsSelector = ({docName, HighlightCode}: Props) => {
  const components = {
    Alert,
    HighlightCode,
    Table,
  };

  return (
    <div style={{padding: '0 20px'}}>
      <MDXProvider components={components}>
        {docName === Docs.Auth && <AuthDocs components={components} />}
        {docName === Docs.Pagination && <PaginationDocs components={components} />}
        {docName === Docs.Permissions && <PermissionsDocs components={components} />}
        {docName === Docs.RateLimits && <RateLimitDocs components={components} />}
        {docName === Docs.Request && <RequestsDocs components={components} />}
      </MDXProvider>
    </div>
  );
};

export default DocsSelector;
