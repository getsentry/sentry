import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconTable} from 'sentry/icons/iconTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Confidence} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';
import {
  useExploreAggregateFields,
  useExploreFields,
  useExploreMode,
  useSetExploreAggregateFields,
  useSetExploreFields,
  useSetExploreMode,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import type {TracesTableResult} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import {AggregateColumnEditorModal} from 'sentry/views/explore/tables/aggregateColumnEditorModal';
import {AggregatesTable} from 'sentry/views/explore/tables/aggregatesTable';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {SpansTable} from 'sentry/views/explore/tables/spansTable';
import {TracesTable} from 'sentry/views/explore/tables/tracesTable/index';

interface BaseExploreTablesProps {
  confidences: Confidence[];
  samplesTab: Tab;
  setSamplesTab: (tab: Tab) => void;
}

interface ExploreTablesProps extends BaseExploreTablesProps {
  aggregatesTableResult: AggregatesTableResult;
  spansTableResult: SpansTableResult;
  tracesTableResult: TracesTableResult;
}

export function ExploreTables(props: ExploreTablesProps) {
  const organization = useOrganization();

  const aggregateFields = useExploreAggregateFields();
  const setAggregateFields = useSetExploreAggregateFields();

  const mode = useExploreMode();
  const setMode = useSetExploreMode();

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
          columns={aggregateFields}
          onColumnsChange={setAggregateFields}
          stringTags={stringTags}
          numberTags={numberTags}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  }, [aggregateFields, setAggregateFields, stringTags, numberTags]);

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
        <Tabs value={tab} onChange={setTab} size="sm">
          <TabList hideBorder variant="floating">
            <TabList.Item key={Tab.SPAN}>{t('Span Samples')}</TabList.Item>
            <TabList.Item key={Tab.TRACE}>{t('Trace Samples')}</TabList.Item>
            <TabList.Item key={Mode.AGGREGATE}>{t('Aggregates')}</TabList.Item>
          </TabList>
        </Tabs>
        {tab === Tab.SPAN ? (
          <Button onClick={openColumnEditor} icon={<IconTable />} size="sm">
            {t('Edit Table')}
          </Button>
        ) : tab === Mode.AGGREGATE &&
          organization.features.includes('visibility-explore-aggregate-editor') ? (
          <Button onClick={openAggregateColumnEditor} icon={<IconTable />} size="sm">
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

const SamplesTableHeader = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;
