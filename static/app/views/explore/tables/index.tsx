import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/core/button';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {Tooltip} from 'sentry/components/core/tooltip';
import DataExport, {ExportQueryType} from 'sentry/components/dataExport';
import {IconDownload} from 'sentry/icons/iconDownload';
import {IconTable} from 'sentry/icons/iconTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Confidence} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
import type {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {downloadAsCsv} from 'sentry/views/discover/utils';
import {
  useExploreFields,
  useSetExploreFields,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import type {TracesTableResult} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import {
  useQueryParamsAggregateFields,
  useSetQueryParamsAggregateFields,
} from 'sentry/views/explore/queryParams/context';
import {AggregateColumnEditorModal} from 'sentry/views/explore/tables/aggregateColumnEditorModal';
import {AggregatesTable} from 'sentry/views/explore/tables/aggregatesTable';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {SpansTable} from 'sentry/views/explore/tables/spansTable';
import {TracesTable} from 'sentry/views/explore/tables/tracesTable/index';

interface BaseExploreTablesProps {
  confidences: Confidence[];
  setTab: (tab: Mode | Tab) => void;
  tab: Mode | Tab;
}

interface ExploreTablesProps extends BaseExploreTablesProps {
  aggregatesTableResult: AggregatesTableResult;
  spansTableResult: SpansTableResult;
  tracesTableResult: TracesTableResult;
}

export function ExploreTables(props: ExploreTablesProps) {
  const organization = useOrganization();

  const aggregateFields = useQueryParamsAggregateFields();
  const setAggregateFields = useSetQueryParamsAggregateFields();

  const fields = useExploreFields();
  const setFields = useSetExploreFields();

  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: stringTags} = useTraceItemTags('string');

  const openColumnEditor = useCallback(() => {
    openModal(
      modalProps => (
        <ColumnEditorModal
          {...modalProps}
          columns={fields}
          onColumnsChange={setFields}
          stringTags={stringTags}
          numberTags={numberTags}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  }, [fields, setFields, stringTags, numberTags]);

  const openAggregateColumnEditor = useCallback(() => {
    openModal(
      modalProps => (
        <AggregateColumnEditorModal
          {...modalProps}
          columns={aggregateFields.slice()}
          onColumnsChange={setAggregateFields}
          stringTags={stringTags}
          numberTags={numberTags}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  }, [aggregateFields, setAggregateFields, stringTags, numberTags]);

  return (
    <Fragment>
      <SamplesTableHeader>
        <Tabs value={props.tab} onChange={props.setTab} size="sm">
          <TabList hideBorder variant="floating">
            <TabList.Item key={Tab.SPAN}>{t('Span Samples')}</TabList.Item>
            <TabList.Item key={Tab.TRACE}>{t('Trace Samples')}</TabList.Item>
            <TabList.Item key={Mode.AGGREGATE}>{t('Aggregates')}</TabList.Item>
          </TabList>
        </Tabs>
        <ButtonGroup>
          <Feature features="organizations:tracing-export-csv">
            <ExploreExportButton {...props} />
          </Feature>
          {props.tab === Tab.SPAN ? (
            <Button onClick={openColumnEditor} icon={<IconTable />} size="sm">
              {t('Edit Table')}
            </Button>
          ) : props.tab === Mode.AGGREGATE &&
            organization.features.includes('visibility-explore-aggregate-editor') ? (
            <Button onClick={openAggregateColumnEditor} icon={<IconTable />} size="sm">
              {t('Edit Table')}
            </Button>
          ) : (
            <Tooltip
              title={
                props.tab === Tab.TRACE
                  ? t('Editing columns is available for span samples only')
                  : t('Use the Group By and Visualize controls to change table columns')
              }
            >
              <Button disabled onClick={openColumnEditor} icon={<IconTable />} size="sm">
                {t('Edit Table')}
              </Button>
            </Tooltip>
          )}
        </ButtonGroup>
      </SamplesTableHeader>
      {props.tab === Tab.SPAN && <SpansTable {...props} />}
      {props.tab === Tab.TRACE && <TracesTable {...props} />}
      {props.tab === Mode.AGGREGATE && <AggregatesTable {...props} />}
    </Fragment>
  );
}

function ExploreExportButton(props: ExploreTablesProps) {
  const location = useLocation();
  const {spansTableResult, aggregatesTableResult, tab} = props;
  let eventView: EventView | null = null;
  let results = null;
  let isPending = false;
  let error: QueryError | null = null;
  let data = [];
  switch (tab) {
    case Tab.SPAN:
      eventView = spansTableResult.eventView;
      isPending = spansTableResult.result.isPending;
      error = spansTableResult.result.error;
      data = spansTableResult.result.data ?? [];
      results = spansTableResult.result;
      break;
    case Mode.AGGREGATE:
      eventView = aggregatesTableResult.eventView;
      isPending = aggregatesTableResult.result.isPending;
      error = aggregatesTableResult.result.error;
      data = aggregatesTableResult.result.data ?? [];
      results = aggregatesTableResult.result;
      break;
    default:
      eventView = null;
      isPending = false;
      error = null;
      data = [];
      results = null;
      break;
  }

  const disabled =
    isPending ||
    error !== null ||
    tab === Tab.TRACE ||
    results === null ||
    eventView === null;

  // TODO(nikki): track analytics

  if (data.length < 50) {
    return (
      <Button
        size="sm"
        disabled={disabled}
        onClick={() =>
          downloadAsCsv(results, eventView?.getColumns(), ExportQueryType.EXPLORE)
        }
        icon={<IconDownload />}
        title={
          disabled
            ? undefined
            : t(
                "There aren't that many results, start your export and it'll download immediately."
              )
        }
      >
        {t('Export All')}
      </Button>
    );
  }

  // TODO: return immediate export button
  return (
    <DataExport
      payload={{
        queryType: ExportQueryType.EXPLORE,
        queryInfo: eventView?.getEventsAPIPayload(location),
      }}
      disabled={disabled}
      icon={<IconDownload />}
    >
      {t('Export All')}
    </DataExport>
  );
}

const SamplesTableHeader = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: ${space(1)};
  gap: ${p => p.theme.space.md};
  flex-wrap: wrap;
`;

const ButtonGroup = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.md};
`;
