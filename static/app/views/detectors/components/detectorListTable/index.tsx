import styled from '@emotion/styled';

import LoadingError from 'sentry/components/loadingError';
import {SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
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
  name,
  sortKey,
  sort,
}: {
  children: React.ReactNode;
  name: string;
  sort: Sort | undefined;
  divider?: boolean;
  sortKey?: string;
}) {
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
      name={name}
      sort={sort}
      sortKey={sortKey}
      handleSortClick={handleSort}
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
    <DetectorListSimpleTable>
      <SimpleTable.Header>
        <HeaderCell name="name" sortKey="name" sort={sort}>
          {t('Name')}
        </HeaderCell>
        <HeaderCell name="type" divider sortKey="type" sort={sort}>
          {t('Type')}
        </HeaderCell>
        <HeaderCell name="issue" divider sort={sort}>
          {t('Last Issue')}
        </HeaderCell>
        <HeaderCell name="assignee" divider sort={sort}>
          {t('Assignee')}
        </HeaderCell>
        <HeaderCell
          name="connected-automations"
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
  );
}

const DetectorListSimpleTable = styled(SimpleTable)`
  grid-template-columns: 1fr;

  .type,
  .creator,
  .last-issue,
  .connected-automations {
    display: none;
  }

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: 3fr 0.8fr;

    .type {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 3fr 0.8fr 1.5fr 0.8fr;

    .last-issue {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 3fr 0.8fr 1.5fr 0.8fr;

    .creator {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: 4.5fr 0.8fr 1.5fr 0.8fr 2fr;

    .connected-automations {
      display: flex;
    }
  }
`;

export default DetectorListTable;
