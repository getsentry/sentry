import styled from '@emotion/styled';

import {SentryAppAvatar} from 'sentry/components/core/avatar/sentryAppAvatar';
import {Tag} from 'sentry/components/core/badge/tag';
import {Link} from 'sentry/components/core/link';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';

import PageHeader from 'admin/components/pageHeader';
import ResultGrid from 'admin/components/resultGrid';

type Props = RouteComponentProps<unknown, unknown>;

const getRow = (row: any) => [
  <td key="name">
    <IntegrationName>
      <SentryAppAvatar size={16} sentryApp={row} />
      <strong>
        <Link to={`/_admin/sentry-apps/${row.slug}/`}>{row.name}</Link>
      </strong>
    </IntegrationName>
  </td>,

  <td key="owner" style={{textAlign: 'center'}}>
    <strong>
      <Link to={`/_admin/customers/${row.owner.slug}/`}>{row.owner.slug}</Link>
    </strong>
  </td>,
  <td key="status" style={{textAlign: 'right'}}>
    <Tag
      variant={
        row.status === 'unpublished'
          ? 'danger'
          : row.status === 'internal'
            ? 'warning'
            : 'success'
      }
    >
      {row.status}
    </Tag>
  </td>,
];

function SentryApps(props: Props) {
  return (
    <div>
      <PageHeader title="Integration Platform Apps" />

      <ResultGrid
        inPanel
        path="/_admin/sentry-apps/"
        endpoint="/sentry-apps/"
        method="GET"
        columns={[
          <th key="name">Name</th>,
          <th key="owner" style={{width: 200, textAlign: 'center'}}>
            Owner
          </th>,
          <th key="status" style={{width: 150, textAlign: 'right'}}>
            Status
          </th>,
        ]}
        columnsForRow={getRow}
        {...props}
      />
    </div>
  );
}

const IntegrationName = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

export default SentryApps;
