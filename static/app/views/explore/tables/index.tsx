import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import {TabList, Tabs} from 'sentry/components/tabs';
import {IconTable} from 'sentry/icons/iconTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Confidence} from 'sentry/types/organization';
import {
  useExploreFields,
  useExploreMode,
  useSetExploreFields,
  useSetExploreMode,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import type {TracesTableResult} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import {AggregatesTable} from 'sentry/views/explore/tables/aggregatesTable';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {SpansTable} from 'sentry/views/explore/tables/spansTable';
import {TracesTable} from 'sentry/views/explore/tables/tracesTable/index';

interface BaseExploreTablesProps {
  confidences: Confidence[];
  isProgressivelyLoading: boolean;
  samplesTab: Tab;
  setSamplesTab: (tab: Tab) => void;
}

interface ExploreTablesProps extends BaseExploreTablesProps {
  aggregatesTableResult: AggregatesTableResult;
  isProgressivelyLoading: boolean;
  spansTableResult: SpansTableResult;
  tracesTableResult: TracesTableResult;
  useTabs: boolean;
}

export function ExploreTables(props: ExploreTablesProps) {
  if (props.useTabs) {
    return <ExploreTablesTabbed {...props} />;
  }
  return <ExploreTablesUntabbed {...props} />;
}

function ExploreTablesTabbed(props: ExploreTablesProps) {
  const mode = useExploreMode();
  const setMode = useSetExploreMode();

  const fields = useExploreFields();
  const setFields = useSetExploreFields();

  const {tags: numberTags} = useSpanTags('number');
  const {tags: stringTags} = useSpanTags('string');

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

  // HACK: This is pretty gross but to not break anything in the
  // short term, we avoid introducing/removing any fields on the
  // query. So we continue using the existing `mode` value and
  // coalesce it with the `tab` value` to create a single tab.
  const tab = mode === Mode.AGGREGATE ? mode : props.samplesTab;
  const setTab = useCallback(
    (option: Tab | Mode) => {
      if (option === Mode.AGGREGATE) {
        setMode(Mode.AGGREGATE);
      } else if (option === Tab.SPAN || option === Tab.TRACE) {
        props.setSamplesTab(option);
      }
    },
    [setMode, props]
  );

  return (
    <Fragment>
      <SamplesTableHeader>
        <Tabs value={tab} onChange={setTab}>
          <TabList hideBorder variant="floating">
            <TabList.Item key={Tab.SPAN}>{t('Span Samples')}</TabList.Item>
            <TabList.Item key={Tab.TRACE}>{t('Trace Samples')}</TabList.Item>
            <TabList.Item key={Mode.AGGREGATE}>{t('Metrics')}</TabList.Item>
          </TabList>
        </Tabs>
        {tab === Tab.SPAN ? (
          <Button onClick={openColumnEditor} icon={<IconTable />} size="sm">
            {t('Edit Table')}
          </Button>
        ) : (
          <Tooltip
            title={
              tab === Tab.TRACE
                ? t('Editing columns is available for span samples only')
                : t('Use the Group By and Visualize controls to change table columns')
            }
          >
            <Button disabled onClick={openColumnEditor} icon={<IconTable />} size="sm">
              {t('Edit Table')}
            </Button>
          </Tooltip>
        )}
      </SamplesTableHeader>
      {tab === Tab.SPAN && <SpansTable {...props} />}
      {tab === Tab.TRACE && <TracesTable {...props} />}
      {tab === Mode.AGGREGATE && <AggregatesTable {...props} />}
    </Fragment>
  );
}

function ExploreTablesUntabbed(props: ExploreTablesProps) {
  const mode = useExploreMode();

  return (
    <Fragment>
      {mode === Mode.AGGREGATE && <ExploreAggregatesTable {...props} />}
      {mode === Mode.SAMPLES && <ExploreSamplesTable {...props} />}
    </Fragment>
  );
}

interface AggregatesExploreTablesProps extends BaseExploreTablesProps {
  aggregatesTableResult: AggregatesTableResult;
  isProgressivelyLoading: boolean;
}

function ExploreAggregatesTable(props: AggregatesExploreTablesProps) {
  return <AggregatesTable {...props} />;
}

interface SamplesExploreTablesProps extends BaseExploreTablesProps {
  isProgressivelyLoading: boolean;
  spansTableResult: SpansTableResult;
  tracesTableResult: TracesTableResult;
}

function ExploreSamplesTable(props: SamplesExploreTablesProps) {
  const fields = useExploreFields();
  const setFields = useSetExploreFields();

  const {tags: numberTags} = useSpanTags('number');
  const {tags: stringTags} = useSpanTags('string');

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

  return (
    <Fragment>
      <SamplesTableHeader>
        <Tabs value={props.samplesTab} onChange={props.setSamplesTab}>
          <TabList hideBorder>
            <TabList.Item key={Tab.SPAN}>{t('Span Samples')}</TabList.Item>
            <TabList.Item key={Tab.TRACE}>{t('Trace Samples')}</TabList.Item>
          </TabList>
        </Tabs>
        <Button
          disabled={props.samplesTab !== Tab.SPAN}
          onClick={openColumnEditor}
          icon={<IconTable />}
        >
          {t('Edit Table')}
        </Button>
      </SamplesTableHeader>
      {props.samplesTab === Tab.SPAN && <SpansTable {...props} />}
      {props.samplesTab === Tab.TRACE && <TracesTable {...props} />}
    </Fragment>
  );
}

const SamplesTableHeader = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;
