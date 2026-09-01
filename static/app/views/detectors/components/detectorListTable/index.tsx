import {
  Fragment,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import styled from '@emotion/styled';
import {useDebouncedValue} from '@tanstack/react-pacer';
import {useQueryState} from 'nuqs';

import NoAlertsImage from 'sentry-images/features/alerts-not-found.svg';

import {Button} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Container, Flex} from '@sentry/scraps/layout';
import {Table, type TableColumnConfig} from '@sentry/scraps/table';

import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import {getNextSort} from 'sentry/components/tables/getNextSort';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {SelectAllHeaderCheckbox} from 'sentry/components/workflowEngine/ui/selectAllHeaderCheckbox';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils/defined';
import {useDimensions} from 'sentry/utils/useDimensions';
import {
  DetectorsTableActions,
  DetectorsTableActionsBanner,
} from 'sentry/views/detectors/components/detectorListTable/actions';
import {
  DetectorListRow,
  DetectorListRowSkeleton,
} from 'sentry/views/detectors/components/detectorListTable/detectorListRow';
import {IssueStreamDetectorContextProvider} from 'sentry/views/detectors/components/detectorListTable/issueStreamDetectorContext';
import {DETECTOR_LIST_PAGE_LIMIT} from 'sentry/views/detectors/list/common/constants';
import {useDetectorListSort} from 'sentry/views/detectors/list/common/useDetectorListSort';
import {
  useMonitorViewContext,
  type MonitorListAdditionalColumn,
} from 'sentry/views/detectors/monitorViewContext';
import {detectorTypeIsUserCreateable} from 'sentry/views/detectors/utils/detectorTypeConfig';
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
  const handleSort = () => {
    if (!sortKey) {
      return;
    }
    setSort(getNextSort(sortKey, sort ?? undefined, 'asc'));
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

export function DetectorListTable({
  detectors,
  isPending,
  isError,
  isSuccess,
  queryCount,
  allResultsVisible,
}: DetectorListTableProps) {
  const [selected, setSelectedIds] = useState(new Set<string>());
  const [allInQuerySelected, setAllInQuerySelected] = useState(false);
  const [isVisualizationExpanded, setIsVisualizationExpanded] = useState(false);

  // Selecting every match only holds while something is selected, so emptying the
  // selection has to clear it too.
  const setSelected = useCallback((ids: Set<string>) => {
    setSelectedIds(ids);
    if (ids.size === 0) {
      setAllInQuerySelected(false);
    }
  }, []);

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
    [selected, setSelected]
  );

  const canEnable = useMemo(
    () => detectors.some(d => selected.has(d.id) && !d.enabled),
    [detectors, selected]
  );
  const canDisable = useMemo(
    () => detectors.some(d => selected.has(d.id) && d.enabled),
    [detectors, selected]
  );

  const uniqueProjectIds = useMemo(
    () => [...new Set(detectors.map(d => d.projectId).filter(defined))],
    [detectors]
  );

  const selectedDetectors = detectors.filter(d => selected.has(d.id));
  const canEditDetectors = useCanEditDetectors({detectors: selectedDetectors});
  const hasSystemCreatedDetectors = selectedDetectors.some(
    d => !detectorTypeIsUserCreateable(d.type)
  );

  const elementRef = useRef<HTMLTableCellElement>(null);
  const {width: containerWidth} = useDimensions({elementRef});
  const [timelineWidth] = useDebouncedValue(containerWidth, {wait: 1000});
  const timeWindowConfig = useTimeWindowConfig({timelineWidth});

  const {
    additionalColumns = [],
    renderVisualization,
    renderTimelineOverlay,
  } = useMonitorViewContext();
  const hasVisualization = defined(renderVisualization);

  return (
    <Container containerType="inline-size">
      <DetectorListSimpleTable
        columns={makeDetectorColumns({
          additionalColumns,
          hasVisualization,
          isVisualizationExpanded,
        })}
        header={
          selected.size === 0 ? (
            <SimpleTable.HeaderRow>
              <HeaderCell sortKey="name">
                <Flex gap="md" align="center">
                  <SelectAllHeaderCheckbox
                    checked={pageSelected || (anySelected ? 'indeterminate' : false)}
                    onChange={checked => togglePageSelected(checked)}
                  />
                  <span>{t('Name')}</span>
                </Flex>
              </HeaderCell>
              <HeaderCell columnKey="type" divider sortKey="type">
                {t('Type')}
              </HeaderCell>
              <HeaderCell columnKey="last-issue" divider sortKey="latestGroup">
                {t('Last Issue')}
              </HeaderCell>
              <HeaderCell columnKey="assignee" divider>
                {t('Assignee')}
              </HeaderCell>
              <HeaderCell
                columnKey="connected-automations"
                divider
                sortKey="connectedWorkflows"
              >
                {t('Alerts')}
              </HeaderCell>
              {additionalColumns.map(col => (
                <Fragment key={col.id}>{col.renderHeaderCell()}</Fragment>
              ))}
              {hasVisualization && detectors.length > 0 && (
                <VisualizationHeaderCell columnKey="visualization" ref={elementRef} scope="col">
                  <GridLineLabels timeWindowConfig={timeWindowConfig} />
                </VisualizationHeaderCell>
              )}
              {hasVisualization && (
                <VisualizationExpandButtonCell columnKey="visualization-expand" scope="col">
                  <Button
                    size="xs"
                    variant="transparent"
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
                    tooltipProps={{
                      title: isVisualizationExpanded
                        ? t('Collapse visualization')
                        : t('Expand visualization'),
                    }}
                    onClick={() => setIsVisualizationExpanded(v => !v)}
                  />
                </VisualizationExpandButtonCell>
              )}
            </SimpleTable.HeaderRow>
          ) : (
            <DetectorsTableActions
              key="actions"
              selected={selected}
              pageSelected={pageSelected}
              togglePageSelected={togglePageSelected}
              queryCount={queryCount}
              allInQuerySelected={allInQuerySelected}
              setAllInQuerySelected={setAllInQuerySelected}
              showDisable={canDisable}
              showEnable={canEnable}
              canEdit={canEditDetectors}
              hasSystemCreatedDetectors={hasSystemCreatedDetectors}
              // TODO: Check if metric detector limit is reached
              detectorLimitReached={false}
            />
          )
        }
      >
        {selected.size > 0 && (
          <DetectorsTableActionsBanner
            selected={selected}
            pageSelected={pageSelected}
            allResultsVisible={allResultsVisible}
            queryCount={queryCount}
            allInQuerySelected={allInQuerySelected}
            setAllInQuerySelected={setAllInQuerySelected}
          />
        )}
        {isError && <SimpleTable.Empty>{t('Error loading monitors')}</SimpleTable.Empty>}
        {isPending && <LoadingSkeletons />}
        {isSuccess && detectors.length === 0 && (
          <SimpleTable.Empty>
            <EmptyState
              title={t('No monitors found.')}
              description={t("Sorry, we couldn't find what you were looking for.")}
              illustration={<img src={NoAlertsImage} />}
            />
          </SimpleTable.Empty>
        )}
        {hasVisualization && detectors.length > 0 && (
          <GridLineOverlayRow>
            <GridLineOverlayCell>
              <PositionedGridLineOverlay
                stickyCursor
                allowZoom
                showCursor
                cursorOffsets={{right: 40}}
                additionalUi={renderTimelineOverlay?.({timeWindowConfig})}
                timeWindowConfig={timeWindowConfig}
                cursorOverlayAnchor="top"
                cursorOverlayAnchorOffset={10}
              />
            </GridLineOverlayCell>
          </GridLineOverlayRow>
        )}
        <IssueStreamDetectorContextProvider projectIds={uniqueProjectIds}>
          {detectors.map(detector => (
            <DetectorListRow
              key={detector.id}
              detector={detector}
              selected={selected.has(detector.id)}
              onSelect={handleSelect}
            />
          ))}
        </IssueStreamDetectorContextProvider>
      </DetectorListSimpleTable>
    </Container>
  );
}

function makeDetectorColumns({
  additionalColumns,
  hasVisualization,
  isVisualizationExpanded,
}: {
  additionalColumns: MonitorListAdditionalColumn[];
  hasVisualization: boolean;
  isVisualizationExpanded: boolean;
}): TableColumnConfig[] {
  // Every column the rows render needs an entry, including the ones this mode
  // never shows: the shell hides a column's cells only for columns it knows
  // about, so leaving one out lets its cells claim a track.
  if (!hasVisualization) {
    return [
      {key: 'name', width: {zero: '1fr', sm: '2fr'}},
      {key: 'type', visible: {zero: false, sm: true}, width: '90px'},
      {key: 'last-issue', visible: {zero: false, '3xl': true}, width: '1.5fr'},
      {key: 'assignee', visible: {zero: false, xl: true}, width: '90px'},
      {key: 'connected-automations', visible: {zero: false, '4xl': true}, width: '110px'},
      ...additionalColumns.map(column => ({key: column.id, visible: false})),
    ];
  }

  // The visualization is two tracks: the chart, then the expand button that
  // overlays its trailing edge.
  const visualizationColumns: TableColumnConfig[] = [
    ...additionalColumns.map(column => ({
      key: column.id,
      visible: {zero: false, xl: true},
      width: column.columnWidth ?? 'auto',
    })),
    {key: 'visualization', visible: {zero: false, xl: true}, width: '3fr'},
    {key: 'visualization-expand', visible: {zero: false, xl: true}, width: 'max-content'},
  ];

  // An expanded visualization takes every column the name does not need; an
  // unexpanded one still outranks the detail columns, which come back at their
  // own breakpoints.
  if (isVisualizationExpanded) {
    return [
      {key: 'name', width: {zero: '1fr', xl: '2fr'}},
      {key: 'type', visible: false},
      {key: 'last-issue', visible: false},
      {key: 'assignee', visible: false},
      {key: 'connected-automations', visible: false},
      ...visualizationColumns,
    ];
  }

  return [
    {key: 'name', width: {zero: '1fr', xl: '2fr'}},
    {key: 'type', visible: false},
    {key: 'last-issue', visible: {zero: false, '4xl': true}, width: '1.5fr'},
    {key: 'assignee', visible: {zero: false, '3xl': true}, width: '90px'},
    {key: 'connected-automations', visible: {zero: false, '5xl': true}, width: '110px'},
    ...visualizationColumns,
  ];
}

const DetectorListSimpleTable = styled(SimpleTable)`
  overflow: clip;
`;

const GridLineOverlayRow = styled(SimpleTable.Row)`
  position: static;
  pointer-events: none;
  grid-row: 1;

  &:not(:last-child) {
    border-bottom: 0;
  }
`;

const GridLineOverlayCell = styled(SimpleTable.RowCell)`
  grid-column: -3 / -1;
  padding: 0;
`;

const PositionedGridLineOverlay = styled(GridLineOverlay)`
  pointer-events: none;
  top: 0;

  display: none;

  @container (min-width: ${p => p.theme.container.xl}) {
    display: block;
  }
`;

const VisualizationHeaderCell = styled(Table.HeadCell)`
  grid-column: -3 / -1;
  border-left: 1px solid ${p => p.theme.tokens.border.secondary};
  min-height: 50px;
  min-width: 0;
`;

const VisualizationExpandButtonCell = styled(Table.HeadCell)`
  grid-row: 1;
  grid-column: -1;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4;
`;
