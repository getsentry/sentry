import moment from 'moment-timezone';

import {LinkButton} from '@sentry/scraps/button';
import {Link} from '@sentry/scraps/link';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

import {PageHeader} from 'admin/components/pageHeader';
import {RelocationBadge} from 'admin/components/relocationBadge';
import type {Relocation} from 'admin/types';
import {titleCase} from 'getsentry/utils/titleCase';

const getRow = (row: Relocation) => {
  return [
    <SimpleTable.RowCell key="uuid">
      <strong>
        <Link
          to={`/_admin/relocations/${row.region ? row.region.name : ''}/${row.uuid}/`}
        >
          {row.uuid}
        </Link>
      </strong>
    </SimpleTable.RowCell>,
    <SimpleTable.RowCell key="status" justify="center">
      <RelocationBadge data={row} />
    </SimpleTable.RowCell>,
    <SimpleTable.RowCell key="step" justify="center">
      {titleCase(row.step)}
    </SimpleTable.RowCell>,
    <SimpleTable.RowCell key="pause" justify="center">
      {row.scheduledPauseAtStep ? titleCase(row.scheduledPauseAtStep) : '--'}
    </SimpleTable.RowCell>,
    <SimpleTable.RowCell key="owner" justify="end">
      {row.owner ? (
        <Link aria-label="Owner" to={`/_admin/users/${row.owner.id}/`}>
          {row.owner.email}
        </Link>
      ) : (
        <i>&lt;deleted&gt;</i>
      )}
    </SimpleTable.RowCell>,
    <SimpleTable.RowCell key="creator" justify="end">
      {row.creator ? (
        <Link aria-label="Creator" to={`/_admin/users/${row.creator.id}/`}>
          {row.creator.email}
        </Link>
      ) : (
        <i>&lt;deleted&gt;</i>
      )}
    </SimpleTable.RowCell>,
    <SimpleTable.RowCell key="started" justify="end">
      {moment(row.dateAdded).fromNow()}
    </SimpleTable.RowCell>,
  ];
};

export function Relocations() {
  return (
    <div>
      <PageHeader title="Relocations">
        <LinkButton variant="primary" to="/_admin/relocations/new/" size="sm">
          Create New Relocation
        </LinkButton>
      </PageHeader>
      <ResultGrid
        inPanel
        isRegional
        path="/_admin/relocations/"
        endpoint="/relocations/"
        columns={[
          {key: 'uuid', label: 'UUID'},
          {key: 'status', label: 'Status', width: 100, align: 'center'},
          {key: 'step', label: 'Step', width: 100, align: 'center'},
          {key: 'pause', label: 'Autopause', width: 100, align: 'center'},
          {key: 'owner', label: 'Owner', width: 200, align: 'right'},
          {key: 'creator', label: 'Creator', width: 200, align: 'right'},
          {key: 'started', label: 'Started', width: 200, align: 'right'},
        ]}
        columnsForRow={getRow}
        hasSearch
        defaultSort="date"
        rowsFromData={(data, cell) => {
          if (cell === undefined) {
            return [];
          }
          return data
            .filter((rawRow: any) => !!rawRow)
            .map((rawRow: any) => {
              return {
                ...rawRow,
                region: cell,
              };
            });
        }}
      />
    </div>
  );
}
