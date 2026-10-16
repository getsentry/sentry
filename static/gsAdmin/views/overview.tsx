import {useState} from 'react';
import styled from '@emotion/styled';
import {IconSync} from '@sentry/icons/sync';
import moment from 'moment-timezone';

import {
  DocIntegrationAvatar,
  OrganizationAvatar,
  SentryAppAvatar,
} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Container} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {DocIntegration} from 'sentry/types/integrations';

import {CustomerContact} from 'admin/components/customerContact';
import {CustomerStatus} from 'admin/components/customerStatus';
import {PercentChange} from 'admin/components/percentChange';

/**
 * DEPRECATION WARNING
 * THIS COMPONENT WILL SOON BE REMOVED
 */
const getAppRow = (row: any) => [
  <SimpleTable.RowCell key={`${row.name}-name`}>
    <Flex align="center" gap="md">
      <SentryAppAvatar size={16} sentryApp={row} />
      {row.name}
    </Flex>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key={`${row.name}-value`} justify="end">
    {row.installs.toLocaleString()}
  </SimpleTable.RowCell>,
];

/**
 * DEPRECATION WARNING
 * THIS COMPONENT WILL SOON BE REMOVED
 */
const getDocIntegrationRow = (doc: DocIntegration) => [
  <SimpleTable.RowCell key={`${doc.name}-name`}>
    <Flex align="center" gap="md">
      <DocIntegrationAvatar size={16} docIntegration={doc} />
      {doc.name}
    </Flex>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key={`${doc.name}-value`} justify="end">
    {doc.popularity}
  </SimpleTable.RowCell>,
];

/**
 * DEPRECATION WARNING
 * THIS COMPONENT WILL SOON BE REMOVED
 */
function SentryAppList() {
  return (
    <ResultGrid
      path="/_admin/"
      endpoint="/sentry-apps-stats/"
      defaultParams={{
        per_page: 10,
      }}
      hasPagination={false}
      columns={[
        {key: 'apps', label: 'Name'},
        {key: 'installs', label: 'Installs', width: 150, align: 'right'},
      ]}
      columnsForRow={getAppRow}
      inPanel
    />
  );
}

/**
 * DEPRECATION WARNING
 * THIS COMPONENT WILL SOON BE REMOVED
 */
function DocIntegrationList() {
  return (
    <ResultGrid
      path="/_admin/"
      endpoint="/doc-integrations/"
      defaultParams={{
        per_page: 10,
      }}
      hasPagination={false}
      columns={[
        {key: 'apps', label: 'Name'},
        {key: 'popularity', label: 'Popularity', width: 150, align: 'right'},
      ]}
      columnsForRow={getDocIntegrationRow}
      inPanel
    />
  );
}

/**
 * DEPRECATION WARNING
 * THIS COMPONENT WILL SOON BE REMOVED
 */
const getCustomerRow = (row: any) => [
  <SimpleTable.RowCell key="customer">
    <CustomerName>
      <OrganizationAvatar size={36} organization={row} />
      <div>
        <strong>
          <Link to={`/_admin/customers/${row.slug}/`}>{row.name}</Link>
        </strong>
        <Text size="xs"> — {row.slug}</Text>
      </div>
      <div>
        <Text size="xs">
          {row.owner && (
            <span>
              <CustomerContact owner={row.owner} />
            </span>
          )}
        </Text>
        {row.isSuspended && (
          <Tooltip title={row.suspensionReason}>
            <Tag variant="danger">Suspended</Tag>
          </Tooltip>
        )}
      </div>
    </CustomerName>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="events" direction="column" gap="xs">
    {row.stats.events24h.toLocaleString()}
    <Text size="xs">
      <PercentChange current={row.stats.events24h} prev={row.stats.eventsPrev24h} />
    </Text>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="members" justify="center">
    {row.totalMembers.toLocaleString()}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="status" justify="center">
    <Text align="center">
      <CustomerStatus customer={row} />
    </Text>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="joined" direction="column" align="end" gap="xs">
    {moment(row.dateJoined).format('MMMM YYYY')}
    <Text size="xs">{moment(row.dateJoined).fromNow()}</Text>
  </SimpleTable.RowCell>,
];

const CustomerName = styled('div')`
  display: grid;
  grid-template: max-content max-content / max-content 1fr;
  gap: ${p => p.theme.space.xs} ${p => p.theme.space.md};

  > :first-child {
    grid-row: 1 / 3;
  }
`;

/**
 * DEPRECATION WARNING
 * THIS COMPONENT WILL SOON BE REMOVED
 */

function CustomersByVolume() {
  const [lastRefresh, setLastRefresh] = useState(new Date());

  return (
    <Container column="1 / 3">
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
        columns={[
          {key: 'customer', label: 'Customer'},
          {key: 'events', label: 'Events (24h)', width: 130, align: 'center'},
          {key: 'members', label: 'Members', width: 100, align: 'center'},
          {key: 'status', label: 'Status', width: 150, align: 'center'},
          {key: 'joined', label: 'Joined', width: 150, align: 'right'},
        ]}
        columnsForRow={getCustomerRow}
        inPanel
      />
    </Container>
  );
}

/**
 * DEPRECATION WARNING
 * THIS COMPONENT WILL SOON BE REMOVED
 */
export function Overview() {
  return (
    <OverviewContainer>
      <CustomersByVolume />
      <div>
        <SectionHeading>
          Integration Platform Apps{' '}
          <LinkButton size="xs" to="/_admin/sentry-apps/">
            More
          </LinkButton>
        </SectionHeading>
        <SentryAppList />
      </div>
      <div>
        <SectionHeading>
          Document Integrations{' '}
          <LinkButton size="xs" to="/_admin/doc-integrations/">
            More
          </LinkButton>
        </SectionHeading>
        <DocIntegrationList />
      </div>
      <Container column="1 / 3">
        <SectionHeading>Signups</SectionHeading>
        <p>
          Go{' '}
          <a href="https://redash.getsentry.net/embed/query/655/visualization/806">
            here
          </a>
          .
        </p>
      </Container>
    </OverviewContainer>
  );
}

const OverviewContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-flow: row;
  gap: 0 ${p => p.theme.space.xl};
  margin-top: ${p => p.theme.space['2xl']};
`;

const SectionHeading = styled('h3')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${p => p.theme.space.md};
`;
