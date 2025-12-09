import moment from 'moment-timezone';

import {OrganizationAvatar} from 'sentry/components/core/avatar/organizationAvatar';
import {Tag} from 'sentry/components/core/badge/tag';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';

import CustomerContact from 'admin/components/customerContact';
import CustomerName from 'admin/components/customerName';
import CustomerStatus from 'admin/components/customerStatus';
import PercentChange from 'admin/components/percentChange';
import ResultGrid from 'admin/components/resultGrid';
import type {Subscription} from 'getsentry/types';
import {displayPrice} from 'getsentry/views/amCheckout/utils';

type ResultGridProps = React.ComponentProps<typeof ResultGrid>;

type Props = Omit<Partial<ResultGridProps>, 'endpoint'> &
  Pick<ResultGridProps, 'endpoint'> & {
    modifyOrgMembershipbutton?: React.ReactNode;
  };

const getRow = (row: Subscription) => [
  <td key="customer">
    <CustomerName>
      <OrganizationAvatar size={36} organization={row as any} />
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
        {row.usageExceeded && <Tag type="warning">Capacity Limit</Tag>}
        {row.isSuspended && (
          <Tooltip title={row.suspensionReason}>
            <Tag type="error">Suspended</Tag>
          </Tooltip>
        )}
      </div>
    </CustomerName>
  </td>,
  <td key="events" style={{textAlign: 'center'}}>
    {row.stats?.events30d.toLocaleString()}
    <br />
    <small>
      {row.stats ? (
        <PercentChange current={row.stats.events30d} prev={row.stats.eventsPrev30d} />
      ) : (
        'Unknown'
      )}
    </small>
  </td>,
  <td key="members" style={{textAlign: 'center'}}>
    {row.totalMembers?.toLocaleString()}
  </td>,
  <td key="status" style={{textAlign: 'center'}}>
    <CustomerStatus customer={row} />
  </td>,
  <td key="ondemand" style={{textAlign: 'center'}}>
    {displayPrice({cents: row.onDemandSpendUsed || 0})}
  </td>,
  <td key="acv" style={{textAlign: 'center'}}>
    {row.acv ? displayPrice({cents: row.acv}) : 'unknown'}
  </td>,
  <td key="joined" style={{textAlign: 'right'}}>
    {moment(row.dateJoined).format('MMMM YYYY')}
    <br />
    <small>{moment(row.dateJoined).fromNow()}</small>
  </td>,
];

function CustomerGrid(props: Props) {
  return (
    <ResultGrid
      inPanel
      isRegional
      path="/_admin/customers/"
      method="GET"
      columns={[
        <th key="customer">Customer</th>,
        <th key="events" style={{width: 130, textAlign: 'center'}}>
          Events (30d)
        </th>,
        <th key="members" style={{width: 85, textAlign: 'center'}}>
          Members
        </th>,
        <th key="status" style={{width: 150, textAlign: 'center'}}>
          Status
        </th>,
        <th key="ondemand" style={{width: 100, textAlign: 'center'}}>
          OnDemand
        </th>,
        <th key="acv" style={{width: 100, textAlign: 'center'}}>
          ACV
        </th>,
        <th key="joined" style={{width: 150, textAlign: 'right'}}>
          Joined
        </th>,
      ]}
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
        usageExceeded: {
          name: 'Usage Exceeded',
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
      buttonGroup={props.modifyOrgMembershipbutton}
      {...props}
    />
  );
}

export default CustomerGrid;
