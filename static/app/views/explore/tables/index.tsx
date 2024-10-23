import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {TabList, Tabs} from 'sentry/components/tabs';
import {IconTable} from 'sentry/icons/iconTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';

import {useSpanTags} from '../contexts/spanTagsContext';

import {TracesTable} from './tracesTable/index';
import {AggregatesTable} from './aggregatesTable';
import {ColumnEditorModal} from './columnEditorModal';
import {SpansTable} from './spansTable';

enum Tab {
  SPAN = 'span',
  TRACE = 'trace',
}

interface ExploreTablesProps {}

export function ExploreTables({}: ExploreTablesProps) {
  const [resultMode] = useResultMode();

  return (
    <Fragment>
      {resultMode === 'aggregate' && <ExploreAggregatesTable />}
      {resultMode === 'samples' && <ExploreSamplesTable />}
    </Fragment>
  );
}

function ExploreAggregatesTable() {
  return <AggregatesTable />;
}

function ExploreSamplesTable() {
  const [tab, setTab] = useState(Tab.SPAN);
  const [fields, setFields] = useSampleFields();
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
        <Tabs value={tab} onChange={setTab}>
          <TabList hideBorder>
            <TabList.Item key={Tab.SPAN}>{t('Span Samples')}</TabList.Item>
            <TabList.Item key={Tab.TRACE}>{t('Trace Samples')}</TabList.Item>
          </TabList>
        </Tabs>
        <Button
          disabled={tab !== Tab.SPAN}
          onClick={openColumnEditor}
          icon={<IconTable />}
        >
          {t('Edit Table')}
        </Button>
      </SamplesTableHeader>
      {tab === Tab.SPAN && <SpansTable />}
      {tab === Tab.TRACE && <TracesTable />}
    </Fragment>
  );
}

const SamplesTableHeader = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;
