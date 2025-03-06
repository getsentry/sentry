import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {TabList, Tabs} from 'sentry/components/tabs';
import {IconTable} from 'sentry/icons/iconTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Confidence} from 'sentry/types/organization';
import {
  useExploreFields,
  useExploreMode,
  useSetExploreFields,
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
  samplesTab: Tab;
  setSamplesTab: (tab: Tab) => void;
}

interface ExploreTablesProps extends BaseExploreTablesProps {
  aggregatesTableResult: AggregatesTableResult;
  spansTableResult: SpansTableResult;
  tracesTableResult: TracesTableResult;
}

export function ExploreTables(props: ExploreTablesProps) {
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
}

function ExploreAggregatesTable(props: AggregatesExploreTablesProps) {
  return <AggregatesTable {...props} />;
}

interface SamplesExploreTablesProps extends BaseExploreTablesProps {
  spansTableResult: SpansTableResult;
  tracesTableResult: TracesTableResult;
}

function ExploreSamplesTable(props: SamplesExploreTablesProps) {
  const fields = useExploreFields();
  const setFields = useSetExploreFields();

  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

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
  margin-bottom: ${space(2)};
`;
