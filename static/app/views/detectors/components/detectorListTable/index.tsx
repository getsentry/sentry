import {
  Fragment,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQueryState} from 'nuqs';

import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import {Container, Flex} from 'sentry/components/core/layout';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {SelectAllHeaderCheckbox} from 'sentry/components/workflowEngine/ui/selectAllHeaderCheckbox';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import {DetectorsTableActions} from 'sentry/views/detectors/components/detectorListTable/actions';
import {
  DetectorListRow,
  DetectorListRowSkeleton,
} from 'sentry/views/detectors/components/detectorListTable/detectorListRow';
import {DETECTOR_LIST_PAGE_LIMIT} from 'sentry/views/detectors/list/common/constants';
import {useDetectorListSort} from 'sentry/views/detectors/list/common/useDetectorListSort';
import {
  useMonitorViewContext,
  type MonitorListAdditionalColumn,
} from 'sentry/views/detectors/monitorViewContext';
import {detectorTypeIsUserCreateable} from 'sentry/views/detectors/utils/detectorTypeConfig';
import {useCanEditDetectors} from 'sentry/views/detectors/utils/useCanEditDetector';
import {CronServiceIncidents} from 'sentry/views/insights/crons/components/serviceIncidents';

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

export function HeaderCell({
  children,
  sortKey,
  ...props
}: {
  children?: React.ReactNode;
  divider?: boolean;
  sortKey?: string;
} & Omit<ComponentProps<typeof SimpleTable.HeaderCell>, 'sort'>) {
  const [sort, setSort] = useDetectorListSort();
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
  const pageSelected =
    !isPending && detectorIds.size !== 0 && detectorIds.difference(selected).size === 0;
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
  const hasSystemCreatedDetectors = selectedDetectors.some(
    d => !detectorTypeIsUserCreateable(d.type)
  );

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 1000);
  const timeWindowConfig = useTimeWindowConfig({timelineWidth});

  const {additionalColumns = [], renderVisualization} = useMonitorViewContext();
  const hasVisualization = defined(renderVisualization);

  return (
    <TableContainer>
      <DetectorListSimpleTable
        hasVisualization={hasVisualization}
        additionalColumns={additionalColumns}
      >
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
            <HeaderCell data-column-name="assignee" divider>
              {t('Assignee')}
            </HeaderCell>
            <HeaderCell
              data-column-name="connected-automations"
              divider
              sortKey="connectedWorkflows"
            >
              {t('Alerts')}
            </HeaderCell>
            {additionalColumns.map(col => (
              <Fragment key={col.id}>{col.renderHeaderCell()}</Fragment>
            ))}
            {hasVisualization && (
              <Container
                data-column-name="visualization"
                ref={elementRef}
                borderLeft="muted"
                minHeight="50px"
              >
                <GridLineLabels timeWindowConfig={timeWindowConfig} />
              </Container>
            )}
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
            hasSystemCreatedDetectors={hasSystemCreatedDetectors}
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
        {hasVisualization && (
          <PositionedGridLineOverlay
            stickyCursor
            allowZoom
            showCursor
            cursorOffsets={{right: 40}}
            additionalUi={<CronServiceIncidents timeWindowConfig={timeWindowConfig} />}
            timeWindowConfig={timeWindowConfig}
            cursorOverlayAnchor="top"
            cursorOverlayAnchorOffset={10}
          />
        )}
      </DetectorListSimpleTable>
    </TableContainer>
  );
}

const TableContainer = styled('div')`
  container-type: inline-size;
`;

const gridDefinitions = (
  p: {theme: Theme},
  additionalColumns: MonitorListAdditionalColumn[]
) => css`
  @container (min-width: ${p.theme.breakpoints.xs}) {
    grid-template-columns: 3fr 0.8fr;

    [data-column-name='type'] {
      display: flex;
    }
  }

  @container (min-width: ${p.theme.breakpoints.sm}) {
    grid-template-columns: 3fr 0.8fr 1.5fr;

    [data-column-name='last-issue'] {
      display: flex;
    }
  }

  @container (min-width: ${p.theme.breakpoints.md}) {
    grid-template-columns: 3fr 0.8fr 1.5fr 0.8fr;

    [data-column-name='assignee'] {
      display: flex;
    }
  }

  @container (min-width: ${p.theme.breakpoints.lg}) {
    grid-template-columns: 4.5fr 0.8fr 1.5fr 0.8fr 1.1fr;

    [data-column-name='connected-automations'] {
      display: flex;
    }
  }

  @container (min-width: ${p.theme.breakpoints.xl}) {
    grid-template-columns: 4.5fr 0.8fr 1.5fr 0.8fr 1.1fr ${additionalColumns
        .map(col => col.columnWidth ?? 'auto')
        .join(' ')};

    ${additionalColumns.map(
      col => css`
        [data-column-name='${col.id}'] {
          display: flex;
        }
      `
    )}
  }
`;

// When there is a visualization, replace the "Type" column with the visualization
const gridDefinitionsWithVisualization = (
  p: {theme: Theme},
  additionalColumns: MonitorListAdditionalColumn[]
) => css`
  @container (min-width: ${p.theme.breakpoints.sm}) {
    grid-template-columns: 3fr 1.5fr;

    [data-column-name='last-issue'] {
      display: flex;
    }
  }

  @container (min-width: ${p.theme.breakpoints.md}) {
    grid-template-columns: 3fr 1.5fr auto;

    [data-column-name='assignee'] {
      display: flex;
    }
  }

  @container (min-width: ${p.theme.breakpoints.lg}) {
    grid-template-columns: 4fr 1.5fr auto 1fr;

    [data-column-name='connected-automations'] {
      display: flex;
    }
  }

  @container (min-width: ${p.theme.breakpoints.xl}) {
    grid-template-columns: 4.5fr 2fr auto 1.1fr ${additionalColumns
        .map(col => col.columnWidth ?? 'auto')
        .join(' ')} 6fr;

    [data-column-name='visualization'] {
      display: block;
    }

    ${additionalColumns.map(
      col => css`
        [data-column-name='${col.id}'] {
          display: flex;
        }
      `
    )}
  }
`;

const DetectorListSimpleTable = styled(SimpleTable)<{
  additionalColumns: MonitorListAdditionalColumn[];
  hasVisualization: boolean;
}>`
  grid-template-columns: 1fr;
  margin-bottom: ${space(2)};

  [data-column-name='type'],
  [data-column-name='last-issue'],
  [data-column-name='assignee'],
  [data-column-name='connected-automations'],
  [data-column-name='visualization'] {
    display: none;
  }

  ${p =>
    p.additionalColumns.map(
      col => css`
        [data-column-name='${col.id}'] {
          display: none;
        }
      `
    )}

  ${p =>
    p.hasVisualization
      ? gridDefinitionsWithVisualization(p, p.additionalColumns)
      : gridDefinitions(p, p.additionalColumns)}
`;

const PositionedGridLineOverlay = styled(GridLineOverlay)`
  grid-column: -2/-1;
  grid-row: 1 / auto;
  pointer-events: none;
  z-index: 3;

  display: none;

  @container (min-width: ${p => p.theme.breakpoints.xl}) {
    display: block;
  }
`;

export default DetectorListTable;
