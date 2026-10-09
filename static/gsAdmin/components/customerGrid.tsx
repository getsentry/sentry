import moment from 'moment-timezone';

import {OrganizationAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ResultGrid, type ResultGridColumn} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

import {CustomerContact} from 'admin/components/customerContact';
import {CustomerName} from 'admin/components/customerName';
import {CustomerStatus} from 'admin/components/customerStatus';
import {PercentChange} from 'admin/components/percentChange';
import type {Subscription} from 'getsentry/types';
import {displayPrice} from 'getsentry/views/amCheckout/utils';

type ResultGridProps = React.ComponentProps<typeof ResultGrid>;

type Props = Omit<Partial<ResultGridProps>, 'endpoint'> &
  Pick<ResultGridProps, 'endpoint'>;

const growth = (current: number | undefined, prev: number | undefined) =>
  current === undefined || !prev ? 0 : current / prev - 1;

/**
 * Mirrors the server's sort keys so the all-regions view can keep merged
 * results ordered client-side. Returns the value the key sorts on, descending.
 */
const sortValueForRow = (row: Subscription, sortBy: string): number => {
  switch (sortBy) {
    case 'date':
      return new Date(row.dateJoined).getTime();
    case 'members':
      return row.totalMembers ?? 0;
    case 'events.30d':
      return row.stats?.events30d ?? 0;
    case 'events.30d.growth':
      return growth(row.stats?.events30d, row.stats?.eventsPrev30d);
    case 'events.24h':
      return row.stats?.events24h ?? 0;
    case 'events.24h.growth':
      return growth(row.stats?.events24h, row.stats?.eventsPrev24h);
    case 'projects':
      return row.totalProjects ?? 0;
    default:
      return 0;
  }
};

const columns: ResultGridColumn[] = [
  {key: 'customer', label: 'Customer'},
  {key: 'events', label: 'Events (30d)', width: 130, align: 'center'},
  {key: 'members', label: 'Members', width: 85, align: 'center'},
  {key: 'status', label: 'Status', width: 150, align: 'center'},
  {key: 'ondemand', label: 'OnDemand', width: 100, align: 'center'},
  {key: 'acv', label: 'ACV', width: 100, align: 'center'},
  {key: 'joined', label: 'Joined', width: 150, align: 'right'},
];

const getRow = (row: Subscription) => [
  <SimpleTable.RowCell key="customer">
    <CustomerName>
      <OrganizationAvatar size={36} organization={row as any} />
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
    {row.stats?.events30d.toLocaleString()}
    <Text size="xs">
      {row.stats ? (
        <PercentChange current={row.stats.events30d} prev={row.stats.eventsPrev30d} />
      ) : (
        'Unknown'
      )}
    </Text>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="members" justify="center">
    {row.totalMembers?.toLocaleString()}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="status" justify="center">
    <Text align="center">
      <CustomerStatus customer={row} />
    </Text>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="ondemand" justify="center">
    {displayPrice({cents: row.onDemandSpendUsed || 0})}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="acv" justify="center">
    {row.acv ? displayPrice({cents: row.acv}) : 'unknown'}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="joined" direction="column" align="end" gap="xs">
    {moment(row.dateJoined).format('MMMM YYYY')}
    <Text size="xs">{moment(row.dateJoined).fromNow()}</Text>
  </SimpleTable.RowCell>,
];

export function CustomerGrid(props: Props) {
  return (
    <ResultGrid
      inPanel
      isCellScoped
      probeAcrossRegions
      // An exact match is an org whose slug equals the searched term, so we can
      // surface the cross-region hint even when only similar slugs come back in
      // the current region. `query` arrives trimmed + lower-cased; org slugs are
      // always lower-case, so a direct comparison is correct.
      exactMatchQuery={(row: Subscription, query: string) => row.slug === query}
      path="/_admin/customers/"
      method="GET"
      sortValueForRow={sortValueForRow}
      columns={columns}
      // Keep the contextual Region column with the other metadata, between
      // ACV and Joined.
      regionColumnIndex={columns.length - 1}
      columnsForRow={getRow}
      hasSearch
      filters={{
        planType: {
          name: 'Plan Type',
          options: [
            ['team', 'Team'],
            ['business', 'Business'],
            ['enterprise', 'Enterprise'],
            ['enterprise_trial', 'Enterprise Trial'],
            ['trial', 'Trial'],
            ['small', 'Small'],
            ['medium', 'Medium'],
            ['large', 'Large'],
            ['sponsored', 'Sponsored'],
            ['free', 'Free'],
          ],
        },
        status: {
          name: 'Status',
          options: [
            ['active', 'Active'],
            ['trialing', 'Trialing'],
            ['trialing_enterprise', 'Trialing (enterprise)'],
            ['past_due', 'Past Due'],
            ['free', 'Free'],
          ],
        },
        paymentMethod: {
          name: 'Payment Method',
          options: [
            ['credit_card', 'Credit Card'],
            ['invoiced', 'Invoiced'],
            ['third_party', 'Third Party'],
          ],
        },
        managed: {
          name: 'Managed',
          options: [
            ['0', 'No'],
            ['1', 'Yes'],
          ],
        },
        suspended: {
          name: 'Suspended',
          options: [
            ['0', 'No'],
            ['1', 'Yes'],
          ],
        },
        softCap: {
          name: 'Soft Cap',
          options: [
            ['0', 'No'],
            ['1', 'Yes'],
          ],
        },
        overageNotifications: {
          name: 'Overage Notifications',
          options: [
            ['0', 'No'],
            ['1', 'Yes'],
          ],
        },
        dataRetention: {
          name: 'Data Retention',
          options: [
            ['0', '30d'],
            ['1', '60d'],
            ['2', '90d'],
          ],
        },
      }}
      sortOptions={[
        ['date', 'Date Joined'],
        ['members', 'Members'],
        ['events.30d', 'Events (30d)'],
        ['events.30d.growth', 'Events (30d) - Growth'],
        ['events.24h', 'Events (24h)'],
        ['events.24h.growth', 'Events (24h) - Growth'],
        ['projects', 'Projects'],
        // TODO(mark) Re-enable this when subscription and billinghistory
        // are in the same database again.
        // ['ondemand.spend', 'OnDemand (Spend)'],
      ]}
      defaultSort="members"
      {...props}
    />
  );
}
