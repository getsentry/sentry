import moment from 'moment-timezone';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';

import PageHeader from 'admin/components/pageHeader';
import RelocationBadge from 'admin/components/relocationBadge';
import ResultGrid from 'admin/components/resultGrid';
import type {Relocation} from 'admin/types';
import titleCase from 'getsentry/utils/titleCase';

const getRow = (row: Relocation) => {
  return [
    <td key="uuid">
      <strong>
        <Link
          to={`/_admin/relocations/${row.region ? row.region.name : ''}/${row.uuid}/`}
        >
          {row.uuid}
        </Link>
      </strong>
    </td>,
    <td key="status" style={{textAlign: 'center'}}>
      <RelocationBadge data={row} />
    </td>,
    <td key="step" style={{textAlign: 'center'}}>
      {titleCase(row.step)}
    </td>,
    <td key="pause" style={{textAlign: 'center'}}>
      {row.scheduledPauseAtStep ? `${titleCase(row.scheduledPauseAtStep)}` : '--'}
    </td>,
    <td key="owner" style={{textAlign: 'right'}}>
      {row.owner ? (
        <Link aria-label="Owner" to={`/_admin/users/${row.owner.id}/`}>
          {row.owner.email}
        </Link>
      ) : (
        <i>&lt;deleted&gt;</i>
      )}
    </td>,
    <td key="creator" style={{textAlign: 'right'}}>
      {row.creator ? (
        <Link aria-label="Creator" to={`/_admin/users/${row.creator.id}/`}>
          {row.creator.email}
        </Link>
      ) : (
        <i>&lt;deleted&gt;</i>
      )}
    </td>,
    <td key="started" style={{textAlign: 'right'}}>
      {moment(row.dateAdded).fromNow()}
    </td>,
  ];
};

export default function Relocations() {
  return (
    <div>
      <PageHeader title="Relocations">
        <LinkButton priority="primary" to="/_admin/relocations/new/" size="sm">
          Create New Relocation
        </LinkButton>
      </PageHeader>

      <ResultGrid
        inPanel
        isRegional
        path="/_admin/relocations/"
        endpoint="/relocations/"
        method="GET"
        columns={[
          <th key="uuid">UUID</th>,
          <th key="status" style={{width: 100, textAlign: 'center'}}>
            Status
          </th>,
          <th key="step" style={{width: 100, textAlign: 'center'}}>
            Step
          </th>,
          <th key="pause" style={{width: 100, textAlign: 'center'}}>
            Autopause
          </th>,
          <th key="owner" style={{width: 200, textAlign: 'right'}}>
            Owner
          </th>,
          <th key="creator" style={{width: 200, textAlign: 'right'}}>
            Creator
          </th>,
          <th key="started" style={{width: 200, textAlign: 'right'}}>
            Started
          </th>,
        ]}
        columnsForRow={getRow}
        hasSearch
        defaultSort="date"
        rowsFromData={(data, region) => {
          if (region === undefined) {
            return [];
          }
          return data
            .filter((rawRow: any) => !!rawRow)
            .map((rawRow: any) => {
              return {
                ...rawRow,
                region,
              };
            });
        }}
      />
    </div>
  );
}
