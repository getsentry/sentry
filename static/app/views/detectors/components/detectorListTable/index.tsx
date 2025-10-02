import {useCallback, useMemo, useState, type ComponentProps} from 'react';
import styled from '@emotion/styled';
import {useQueryState} from 'nuqs';

import {Flex} from 'sentry/components/core/layout';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {SelectAllHeaderCheckbox} from 'sentry/components/workflowEngine/ui/selectAllHeaderCheckbox';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import type {Sort} from 'sentry/utils/discover/fields';
import {parseAsSort} from 'sentry/utils/queryString';
import {DetectorsTableActions} from 'sentry/views/detectors/components/detectorListTable/actions';
import {
  DetectorListRow,
  DetectorListRowSkeleton,
} from 'sentry/views/detectors/components/detectorListTable/detectorListRow';
import {DETECTOR_LIST_PAGE_LIMIT} from 'sentry/views/detectors/constants';
import {useCanEditDetectors} from 'sentry/views/detectors/utils/useCanEditDetector';

type DetectorListTableProps = {
  allResultsVisible: boolean;
  detectors: Detector[];
  isError: boolean;
  isPending: boolean;
  isSuccess: boolean;
  queryCount: string;
};

function LoadingSkeletons() {
  return Array.from({length: DETECTOR_LIST_PAGE_LIMIT}).map((_, index) => (
    <DetectorListRowSkeleton key={index} />
  ));
}

function HeaderCell({
  children,
  sortKey,
  ...props
}: {
  children: React.ReactNode;
  divider?: boolean;
  sortKey?: string;
} & Omit<ComponentProps<typeof SimpleTable.HeaderCell>, 'sort'>) {
  const [sort, setSort] = useQueryState('sort', parseAsSort);
  const [, setCursor] = useQueryState('cursor');
  const isSortedByField = sort?.field === sortKey;
  const handleSort = () => {
    if (!sortKey) {
      return;
    }
    const sortDirection = sort && isSortedByField && sort.kind === 'asc' ? 'desc' : 'asc';
    setSort({field: sortKey, kind: sortDirection});
    setCursor(null);
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
  queryCount,
  allResultsVisible,
}: DetectorListTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const detectorIds = new Set(detectors.map(d => d.id));
  const togglePageSelected = (pageSelected: boolean) => {
    if (pageSelected) {
      setSelected(detectorIds);
    } else {
      setSelected(new Set<string>());
    }
  };
  const pageSelected = !isPending && detectorIds.difference(selected).size === 0;
  const anySelected = selected.size > 0;

  const handleSelect = useCallback(
    (id: string) => {
      const newSelected = new Set(selected);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setSelected(newSelected);
    },
    [selected]
  );

  const canEnable = useMemo(
    () => detectors.some(d => selected.has(d.id) && !d.enabled),
    [detectors, selected]
  );
  const canDisable = useMemo(
    () => detectors.some(d => selected.has(d.id) && d.enabled),
    [detectors, selected]
  );

  const selectedDetectors = detectors.filter(d => selected.has(d.id));
  const canEditDetectors = useCanEditDetectors({detectors: selectedDetectors});

  return (
    <Container>
      <DetectorListSimpleTable>
        {selected.size === 0 ? (
          <SimpleTable.Header>
            <HeaderCell sortKey="name">
              <Flex gap="md" align="center">
                <SelectAllHeaderCheckbox
                  checked={pageSelected || (anySelected ? 'indeterminate' : false)}
                  onChange={checked => togglePageSelected(checked)}
                />
                <span>{t('Name')}</span>
              </Flex>
            </HeaderCell>
            <HeaderCell data-column-name="type" divider sortKey="type">
              {t('Type')}
            </HeaderCell>
            <HeaderCell data-column-name="last-issue" divider sortKey="latestGroup">
              {t('Last Issue')}
            </HeaderCell>
            <HeaderCell data-column-name="assignee" divider sortKey="assignee">
              {t('Assignee')}
            </HeaderCell>
            <HeaderCell
              data-column-name="connected-automations"
              divider
              sortKey="connectedWorkflows"
            >
              {t('Automations')}
            </HeaderCell>
          </SimpleTable.Header>
        ) : (
          <DetectorsTableActions
            key="actions"
            selected={selected}
            pageSelected={pageSelected}
            togglePageSelected={togglePageSelected}
            queryCount={queryCount}
            allResultsVisible={allResultsVisible}
            showDisable={canDisable}
            showEnable={canEnable}
            canEdit={canEditDetectors}
            // TODO: Check if metric detector limit is reached
            detectorLimitReached={false}
          />
        )}
        {isError && <SimpleTable.Empty>{t('Error loading monitors')}</SimpleTable.Empty>}
        {isPending && <LoadingSkeletons />}
        {isSuccess && detectors.length === 0 && (
          <SimpleTable.Empty>{t('No monitors found')}</SimpleTable.Empty>
        )}
        {detectors.map(detector => (
          <DetectorListRow
            key={detector.id}
            detector={detector}
            selected={selected.has(detector.id)}
            onSelect={handleSelect}
          />
        ))}
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
    grid-template-columns: 3fr 0.8fr 1.5fr;

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
    grid-template-columns: 4.5fr 0.8fr 1.5fr 0.8fr 1.1fr;

    [data-column-name='connected-automations'] {
      display: flex;
    }
  }
`;

export default DetectorListTable;
