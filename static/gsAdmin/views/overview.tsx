import {useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {DocIntegrationAvatar} from '@sentry/scraps/avatar';
import {Flex} from '@sentry/scraps/layout';

import {OrganizationAvatar} from 'sentry/components/core/avatar/organizationAvatar';
import {SentryAppAvatar} from 'sentry/components/core/avatar/sentryAppAvatar';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconSync} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {DocIntegration} from 'sentry/types/integrations';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';

import CustomerContact from 'admin/components/customerContact';
import CustomerStatus from 'admin/components/customerStatus';
import PercentChange from 'admin/components/percentChange';
import ResultGrid from 'admin/components/resultGrid';

type Props = RouteComponentProps<unknown, unknown>;

/**
 * DEPRECATION WARNING
 * THIS COMPONENT WILL SOON BE REMOVED
 */
const getAppRow = (row: any) => [
  <td key={`${row.name}-name`}>
    <Flex align="center" gap="md">
      <SentryAppAvatar size={16} sentryApp={row} />
      {row.name}
    </Flex>
  </td>,
  <td key={`${row.name}-value`} style={{textAlign: 'right'}}>
    {row.installs.toLocaleString()}
  </td>,
];

/**
 * DEPRECATION WARNING
 * THIS COMPONENT WILL SOON BE REMOVED
 */
const getDocIntegrationRow = (doc: DocIntegration) => [
  <td key={`${doc.name}-name`}>
    <Flex align="center" gap="md">
      <DocIntegrationAvatar size={16} docIntegration={doc} />
      {doc.name}
    </Flex>
  </td>,
  <td key={`${doc.name}-value`} style={{textAlign: 'right'}}>
    {doc.popularity}
  </td>,
];

/**
 * DEPRECATION WARNING
 * THIS COMPONENT WILL SOON BE REMOVED
 */
function SentryAppList(props: Props) {
  return (
    <ResultGrid
      path="/_admin/"
      endpoint="/sentry-apps-stats/"
      defaultParams={{
        per_page: 10,
      }}
      hasPagination={false}
      method="GET"
      columns={[
        <th key="apps">Name</th>,
        <th key="installs" style={{width: 150, textAlign: 'right'}}>
          Installs
        </th>,
      ]}
      columnsForRow={getAppRow}
      inPanel
      {...props}
    />
  );
}

/**
 * DEPRECATION WARNING
 * THIS COMPONENT WILL SOON BE REMOVED
 */
function DocIntegrationList(props: Props) {
  return (
    <ResultGrid
      path="/_admin/"
      endpoint="/doc-integrations/"
      defaultParams={{
        per_page: 10,
      }}
      hasPagination={false}
      method="GET"
      columns={[
        <th key="apps">Name</th>,
        <th key="popularity" style={{width: 150, textAlign: 'right'}}>
          Popularity
        </th>,
      ]}
      columnsForRow={getDocIntegrationRow}
      inPanel
      {...props}
    />
  );
}

/**
 * DEPRECATION WARNING
 * THIS COMPONENT WILL SOON BE REMOVED
 */
const getCustomerRow = (row: any) => [
  <td key="customer">
    <CustomerName>
      <OrganizationAvatar size={36} organization={row} />
      <div>
        <strong>
          <Link to={`/_admin/customers/${row.slug}/`}>{row.name}</Link>
        </strong>
        <small> — {row.slug}</small>
      </div>
      <div>
        <small>
          {row.owner && (
            <span>
              <CustomerContact owner={row.owner} />
            </span>
          )}
        </small>
        {row.usageExceeded && <Tag variant="warning">Capacity Limit</Tag>}
        {row.isSuspended && (
          <Tooltip title={row.suspensionReason}>
            <Tag variant="danger">Suspended</Tag>
          </Tooltip>
        )}
      </div>
    </CustomerName>
  </td>,
  <td key="events" style={{textAlign: 'center'}}>
    {row.stats.events24h.toLocaleString()}
    <br />
    <small>
      <PercentChange current={row.stats.events24h} prev={row.stats.eventsPrev24h} />
    </small>
  </td>,
  <td key="members" style={{textAlign: 'center'}}>
    {row.totalMembers.toLocaleString()}
  </td>,
  <td key="status" style={{textAlign: 'center'}}>
    <CustomerStatus customer={row} />
  </td>,
  <td key="joined" style={{textAlign: 'right'}}>
    {moment(row.dateJoined).format('MMMM YYYY')}
    <br />
    <small>{moment(row.dateJoined).fromNow()}</small>
  </td>,
];

const CustomerName = styled('div')`
  display: grid;
  grid-template: max-content max-content / max-content 1fr;
  gap: ${space(0.5)} ${space(1)};

  > :first-child {
    grid-row: 1 / 3;
  }
`;

/**
 * DEPRECATION WARNING
 * THIS COMPONENT WILL SOON BE REMOVED
 */

function CustomersByVolume(props: Props) {
  const [lastRefresh, setLastRefresh] = useState(new Date());

  return (
    <SectionFull>
      <SectionHeading>
        <span>
          Customers by Volume <small>(last 24h)</small>
        </span>
        <Button
          size="xs"
          onClick={() => setLastRefresh(new Date())}
          icon={<IconSync size="xs" />}
        >
          Refresh
        </Button>
      </SectionHeading>

      <ResultGrid
        key={lastRefresh.toString()}
        path="/_admin/"
        endpoint="/customers/"
        defaultParams={{
          per_page: 10,
        }}
        defaultSort="events.24h"
        hasPagination={false}
        method="GET"
        columns={[
          <th key="customer">Customer</th>,
          <th key="events" style={{width: 130, textAlign: 'center'}}>
            Events (24h)
          </th>,
          <th key="members" style={{width: 100, textAlign: 'center'}}>
            Members
          </th>,
          <th key="status" style={{width: 150, textAlign: 'center'}}>
            Status
          </th>,
          <th key="joined" style={{width: 150, textAlign: 'right'}}>
            Joined
          </th>,
        ]}
        columnsForRow={getCustomerRow}
        inPanel
        {...props}
      />
    </SectionFull>
  );
}

/**
 * DEPRECATION WARNING
 * THIS COMPONENT WILL SOON BE REMOVED
 */
function Overview(props: Props) {
  return (
    <OverviewContainer>
      <CustomersByVolume {...props} />
      <div>
        <SectionHeading>
          Integration Platform Apps{' '}
          <LinkButton size="xs" to="/_admin/sentry-apps/">
            More
          </LinkButton>
        </SectionHeading>
        <SentryAppList {...props} />
      </div>
      <div>
        <SectionHeading>
          Document Integrations{' '}
          <LinkButton size="xs" to="/_admin/doc-integrations/">
            More
          </LinkButton>
        </SectionHeading>
        <DocIntegrationList {...props} />
      </div>
      <SectionFull>
        <SectionHeading>Signups</SectionHeading>
        <p>
          Go{' '}
          <a href="https://redash.getsentry.net/embed/query/655/visualization/806">
            here
          </a>
          .
        </p>
      </SectionFull>
    </OverviewContainer>
  );
}

const OverviewContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-flow: row;
  gap: 0 ${space(2)};
  margin-top: ${space(3)};
`;

const SectionFull = styled('div')`
  grid-column: 1 / 3;
`;

const SectionHeading = styled('h3')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(1)};
`;

export default Overview;
