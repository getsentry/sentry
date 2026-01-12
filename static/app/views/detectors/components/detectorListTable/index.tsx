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
import {Button} from 'sentry/components/core/button';
import {Container, Flex} from 'sentry/components/core/layout';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {SelectAllHeaderCheckbox} from 'sentry/components/workflowEngine/ui/selectAllHeaderCheckbox';
import {IconChevron} from 'sentry/icons';
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
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';
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

// We want to display all workflows which might trigger an alert for a given detector.
// This includes those directly connected to the detector as well as those connected to
// issue stream detectors of the same project.
function getConnectedWorkflowIdsForDetector({
  detector,
  issueStreamDetectorByProjectId,
}: {
  detector: Detector;
  issueStreamDetectorByProjectId: Map<string, Detector>;
}) {
  const issueStreamDetector = issueStreamDetectorByProjectId.get(detector.projectId);
  const issueStreamWorkflowIds =
    issueStreamDetector && issueStreamDetector.id !== detector.id
      ? issueStreamDetector.workflowIds
      : [];

  const combinedWorkflowIds = new Set([
    ...detector.workflowIds,
    ...issueStreamWorkflowIds,
  ]);
  return [...combinedWorkflowIds];
}

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
  const [isVisualizationExpanded, setIsVisualizationExpanded] = useState(false);

  const projectIds = useMemo(
    () =>
      Array.from(
        new Set(detectors.map(d => Number(d.projectId)).filter(Number.isFinite))
      ),
    [detectors]
  );

  const {data: issueStreamDetectors, isPending: issueStreamDetectorsPending} =
    useDetectorsQuery(
      {
        query: 'type:issue_stream',
        projects: projectIds,
        includeIssueStreamDetectors: true,
      },
      {enabled: projectIds.length > 0}
    );

  const issueStreamDetectorByProjectId = useMemo(() => {
    const mapping = new Map<string, Detector>();
    for (const detector of issueStreamDetectors ?? []) {
      if (!mapping.has(detector.projectId)) {
        mapping.set(detector.projectId, detector);
      }
    }
    return mapping;
  }, [issueStreamDetectors]);

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
        isVisualizationExpanded={isVisualizationExpanded}
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
              <VisualizationHeaderContainer
                data-column-name="visualization"
                ref={elementRef}
                borderLeft="muted"
                minHeight="50px"
              >
                <GridLineLabels timeWindowConfig={timeWindowConfig} />
              </VisualizationHeaderContainer>
            )}
            {hasVisualization && (
              <VisualizationExpandButton>
                <Button
                  size="xs"
                  borderless
                  icon={
                    <IconChevron
                      isDouble
                      direction={isVisualizationExpanded ? 'right' : 'left'}
                    />
                  }
                  aria-label={
                    isVisualizationExpanded
                      ? t('Collapse visualization')
                      : t('Expand visualization')
                  }
                  title={
                    isVisualizationExpanded
                      ? t('Collapse visualization')
                      : t('Expand visualization')
                  }
                  onClick={() => setIsVisualizationExpanded(v => !v)}
                />
              </VisualizationExpandButton>
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
        {detectors.map(detector => (
          <DetectorListRow
            key={detector.id}
            detector={detector}
            connectedWorkflowsPending={issueStreamDetectorsPending}
            connectedWorkflowIds={getConnectedWorkflowIdsForDetector({
              detector,
              issueStreamDetectorByProjectId,
            })}
            selected={selected.has(detector.id)}
            onSelect={handleSelect}
          />
        ))}
      </DetectorListSimpleTable>
    </TableContainer>
  );
}

const TableContainer = styled('div')`
  container-type: inline-size;
`;

type ColumnNames =
  | 'name'
  | 'type'
  | 'assignee'
  | 'last-issue'
  | 'connected-automations'
  | 'visualization';

function makeGridSizes(additionalColumns: MonitorListAdditionalColumn[]) {
  const additionalColumnSizes = additionalColumns
    .map(col => col.columnWidth ?? 'auto')
    .join(' ');

  return css`
    --detector-table-name: 2fr;
    --detector-table-type: 90px;
    --detector-table-assignee: 90px;
    --detector-table-last-issue: 1.5fr;
    --detector-table-connected-automations: 110px;

    /* Table visualization has two columns to account for the expand button */
    --detector-table-visualization: ${additionalColumnSizes} 3fr max-content;
  `;
}

function makeGridTemplate(columns: ColumnNames[]) {
  return `grid-template-columns:
    ${columns.map(col => `var(--detector-table-${col})`).join('\n    ')};`;
}

const gridDefinitions = (
  p: {theme: Theme},
  additionalColumns: MonitorListAdditionalColumn[]
) => {
  return css`
    ${makeGridSizes(additionalColumns)};

    @container (min-width: ${p.theme.breakpoints.xs}) {
      ${makeGridTemplate(['name', 'type'])}

      [data-column-name='type'] {
        display: flex;
      }
    }

    @container (min-width: ${p.theme.breakpoints.sm}) {
      ${makeGridTemplate(['name', 'type', 'assignee'])}

      [data-column-name='assignee'] {
        display: flex;
      }
    }

    @container (min-width: ${p.theme.breakpoints.md}) {
      ${makeGridTemplate(['name', 'type', 'last-issue', 'assignee'])}

      [data-column-name='last-issue'] {
        display: flex;
      }
    }

    @container (min-width: ${p.theme.breakpoints.lg}) {
      ${makeGridTemplate([
        'name',
        'type',
        'last-issue',
        'assignee',
        'connected-automations',
      ])}

      [data-column-name='connected-automations'] {
        display: flex;
      }
    }

    @container (min-width: ${p.theme.breakpoints.xl}) {
      ${makeGridTemplate([
        'name',
        'type',
        'last-issue',
        'assignee',
        'connected-automations',
      ])}
    }
  `;
};

// When there is a visualization, prioritize showing it over other columns
const gridDefinitionsWithVisualization = (
  p: {theme: Theme},
  additionalColumns: MonitorListAdditionalColumn[]
) => {
  const additionalColumnDisplay = additionalColumns.map(
    col => css`
      [data-column-name='${col.id}'] {
        display: flex;
      }
    `
  );

  return css`
    ${makeGridSizes(additionalColumns)};

    @container (min-width: ${p.theme.breakpoints.sm}) {
      ${makeGridTemplate(['name', 'visualization'])}

      [data-column-name='visualization'] {
        display: block;
      }

      ${additionalColumnDisplay}
    }

    @container (min-width: ${p.theme.breakpoints.md}) {
      ${makeGridTemplate(['name', 'assignee', 'visualization'])}

      [data-column-name='assignee'] {
        display: flex;
      }
    }

    @container (min-width: ${p.theme.breakpoints.lg}) {
      ${makeGridTemplate(['name', 'last-issue', 'assignee', 'visualization'])}

      [data-column-name='last-issue'] {
        display: flex;
      }
    }

    @container (min-width: ${p.theme.breakpoints.xl}) {
      ${makeGridTemplate([
        'name',
        'last-issue',
        'assignee',
        'connected-automations',
        'visualization',
      ])}

      [data-column-name='connected-automations'] {
        display: flex;
      }
    }
  `;
};

// When visualization is expanded, only show name and visualization
const gridDefinitionsWithVisualizationExpanded = (
  p: {theme: Theme},
  additionalColumns: MonitorListAdditionalColumn[]
) => {
  const additionalColumnDisplay = additionalColumns.map(
    col => css`
      [data-column-name='${col.id}'] {
        display: flex;
      }
    `
  );

  return css`
    ${makeGridSizes(additionalColumns)};

    @container (min-width: ${p.theme.breakpoints.sm}) {
      ${makeGridTemplate(['name', 'visualization'])}

      [data-column-name='visualization'] {
        display: block;
      }

      ${additionalColumnDisplay}
    }
  `;
};

const DetectorListSimpleTable = styled(SimpleTable)<{
  additionalColumns: MonitorListAdditionalColumn[];
  hasVisualization: boolean;
  isVisualizationExpanded: boolean;
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

  ${p => {
    if (p.isVisualizationExpanded) {
      return gridDefinitionsWithVisualizationExpanded(p, p.additionalColumns);
    }
    if (p.hasVisualization) {
      return gridDefinitionsWithVisualization(p, p.additionalColumns);
    }
    return gridDefinitions(p, p.additionalColumns);
  }}

  @container (min-width: ${p => p.theme.breakpoints.sm}) {
    [data-column-name='visualization'] {
      grid-column: -3 / -1;
    }
  }
`;

const PositionedGridLineOverlay = styled(GridLineOverlay)`
  grid-column: -3 / -1;
  grid-row: 1 / auto;
  pointer-events: none;
  z-index: 3;

  display: none;

  @container (min-width: ${p => p.theme.breakpoints.sm}) {
    display: block;
  }
`;

const VisualizationHeaderContainer = styled(Container)`
  grid-column: -3 / -1;
`;

const VisualizationExpandButton = styled('div')`
  grid-row: 1;
  grid-column: -1;
  padding: ${space(1.5)} ${space(2)};
  display: none;
  z-index: 4;

  @container (min-width: ${p => p.theme.breakpoints.sm}) {
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

export default DetectorListTable;
