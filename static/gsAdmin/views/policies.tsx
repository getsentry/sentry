import moment from 'moment-timezone';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {ResultGrid} from 'sentry/components/resultGrid';

import {PageHeader} from 'admin/components/pageHeader';
import {AddPolicyModal} from 'admin/components/policies/addPolicyModal';

const getRow = (row: any) => [
  <td key="policy">
    <strong>
      <Link to={`/_admin/policies/${row.slug}/`}>{row.name}</Link>
    </strong>
  </td>,
  <td key="version" style={{textAlign: 'center'}}>
    {row.version ? row.version : 'n/a'}
  </td>,
  <td key="updated" style={{textAlign: 'right'}}>
    {row.updatedAt ? moment(row.updatedAt).fromNow() : 'n/a'}
  </td>,
];

export function Policies() {
  const {openModal} = useModal();
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
          >
            Add Policy
          </Button>
        </Flex>
      </PageHeader>

      <ResultGrid
        key={status}
        inPanel
        path="/_admin/policies/"
        endpoint="/policies/"
        defaultParams={{per_page: 50, include: status}}
        columns={[
          <th key="policy">Policy</th>,
          <th key="value" style={{width: 100, textAlign: 'center'}}>
            Version
          </th>,
          <th key="claims" style={{width: 150, textAlign: 'right'}}>
            Updated
          </th>,
        ]}
        columnsForRow={getRow}
      />
    </div>
  );
}
