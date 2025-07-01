import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import LoadingError from 'sentry/components/loadingError';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  DetectorListRow,
  DetectorListRowSkeleton,
} from 'sentry/views/detectors/components/detectorListTable/detectorListRow';
import {DETECTOR_LIST_PAGE_LIMIT} from 'sentry/views/detectors/constants';

type DetectorListTableProps = {
  detectors: Detector[];
  isError: boolean;
  isPending: boolean;
  isSuccess: boolean;
  sort: Sort | undefined;
};

function LoadingSkeletons() {
  return Array.from({length: DETECTOR_LIST_PAGE_LIMIT}).map((_, index) => (
    <DetectorListRowSkeleton key={index} />
  ));
}

function HeaderCell({
  children,
  sortKey,
  sort,
  ...props
}: {
  children: React.ReactNode;
  sort: Sort | undefined;
  divider?: boolean;
  sortKey?: string;
} & Omit<ComponentProps<typeof SimpleTable.HeaderCell>, 'sort'>) {
  const location = useLocation();
  const navigate = useNavigate();
  const isSortedByField = sort?.field === sortKey;
  const handleSort = () => {
    if (!sortKey) {
      return;
    }
    const newSort =
      sort && isSortedByField ? `${sort.kind === 'asc' ? '-' : ''}${sortKey}` : sortKey;
    navigate({
      pathname: location.pathname,
      query: {...location.query, sort: newSort, cursor: undefined},
    });
  };

  return (
    <SimpleTable.HeaderCell
      {...props}
      sort={sort && sortKey === sort?.field ? sort.kind : undefined}
      handleSortClick={sortKey ? handleSort : undefined}
    >
      {children}
    </SimpleTable.HeaderCell>
  );
}

function DetectorListTable({
  detectors,
  isPending,
  isError,
  isSuccess,
  sort,
}: DetectorListTableProps) {
  return (
    <Container>
      <DetectorListSimpleTable>
        <SimpleTable.Header>
          <HeaderCell sortKey="name" sort={sort}>
            {t('Name')}
          </HeaderCell>
          <HeaderCell data-column-name="type" divider sortKey="type" sort={sort}>
            {t('Type')}
          </HeaderCell>
          <HeaderCell data-column-name="last-issue" divider sort={sort}>
            {t('Last Issue')}
          </HeaderCell>
          <HeaderCell data-column-name="assignee" divider sort={sort}>
            {t('Assignee')}
          </HeaderCell>
          <HeaderCell
            data-column-name="connected-automations"
            divider
            sortKey="connectedWorkflows"
            sort={sort}
          >
            {t('Automations')}
          </HeaderCell>
        </SimpleTable.Header>
        {isError && <LoadingError message={t('Error loading monitors')} />}
        {isPending && <LoadingSkeletons />}
        {isSuccess && detectors.length > 0 ? (
          detectors.map(detector => (
            <DetectorListRow key={detector.id} detector={detector} />
          ))
        ) : (
          <SimpleTable.Empty>{t('No monitors found')}</SimpleTable.Empty>
        )}
      </DetectorListSimpleTable>
    </Container>
  );
}

const Container = styled('div')`
  container-type: inline-size;
`;

const DetectorListSimpleTable = styled(SimpleTable)`
  grid-template-columns: 1fr;

  margin-bottom: ${space(2)};

  [data-column-name='type'],
  [data-column-name='last-issue'],
  [data-column-name='assignee'],
  [data-column-name='connected-automations'] {
    display: none;
  }

  @container (min-width: ${p => p.theme.breakpoints.xs}) {
    grid-template-columns: 3fr 0.8fr;

    [data-column-name='type'] {
      display: flex;
    }
  }

  @container (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 3fr 0.8fr 1.5fr 0.8fr;

    [data-column-name='last-issue'] {
      display: flex;
    }
  }

  @container (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: 3fr 0.8fr 1.5fr 0.8fr;

    [data-column-name='assignee'] {
      display: flex;
    }
  }

  @container (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: 4.5fr 0.8fr 1.5fr 0.8fr 2fr;

    [data-column-name='connected-automations'] {
      display: flex;
    }
  }
`;

export default DetectorListTable;
