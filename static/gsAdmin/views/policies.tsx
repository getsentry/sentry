import moment from 'moment-timezone';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {ConfigStore} from 'sentry/stores/configStore';

import {PageHeader} from 'admin/components/pageHeader';
import {AddPolicyModal} from 'admin/components/policies/addPolicyModal';

const getRow = (row: any) => [
  <SimpleTable.RowCell key="policy">
    <strong>
      <Link to={`/_admin/policies/${row.slug}/`}>{row.name}</Link>
    </strong>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="version" justify="center">
    {row.version ? row.version : 'n/a'}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="updated" justify="end">
    {row.updatedAt ? moment(row.updatedAt).fromNow() : 'n/a'}
  </SimpleTable.RowCell>,
];

export function Policies() {
  const {openModal} = useModal();
  const hasPermission = ConfigStore.get('user').permissions.has('policies.admin');
  const [status, setStatus] = useQueryState(
    'include',
    parseAsStringLiteral(['active', 'all'] as const).withDefault('active')
  );

  return (
    <div>
      <PageHeader title="Policies">
        <Flex align="center" gap="md">
          <CompactSelect
            value={status}
            options={[
              {value: 'active', label: 'Active policies'},
              {value: 'all', label: 'All policies'},
            ]}
            onChange={option => setStatus(option.value === 'all' ? 'all' : 'active')}
            trigger={triggerProps => (
              <OverlayTrigger.Button {...triggerProps} prefix="Show" size="sm" />
            )}
          />
          <Button
            onClick={() => openModal(deps => <AddPolicyModal {...deps} />)}
            size="sm"
            disabled={!hasPermission}
            tooltipProps={{
              title: hasPermission
                ? undefined
                : "You don't have the policies.admin permission",
            }}
          >
            Add Policy
          </Button>
        </Flex>
      </PageHeader>

      <ResultGrid
        inPanel
        path="/_admin/policies/"
        endpoint="/policies/"
        defaultParams={{per_page: 50, include: status}}
        columns={[
          {key: 'policy', label: 'Policy'},
          {key: 'version', label: 'Version', width: 100, align: 'center'},
          {key: 'updated', label: 'Updated', width: 150, align: 'right'},
        ]}
        columnsForRow={getRow}
      />
    </div>
  );
}
