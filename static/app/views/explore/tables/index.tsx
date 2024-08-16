import {Fragment, useState} from 'react';

import {TabList, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';

import {SpansTable} from './spansTable';
import {TracesTable} from './tracesTable';

enum Tab {
  SPAN = 'span',
  TRACE = 'trace',
}

interface ExploreTablesProps {}

export function ExploreTables({}: ExploreTablesProps) {
  const [resultMode] = useResultMode();

  return (
    <Fragment>
      {resultMode === 'aggregate' && <ExploreAggregateTable />}
      {resultMode === 'samples' && <ExploreSamplesTable />}
    </Fragment>
  );
}

function ExploreAggregateTable() {
  return <div>TODO: aggregate table</div>;
}

function ExploreSamplesTable() {
  const [tab, setTab] = useState(Tab.SPAN);

  return (
    <Fragment>
      <Tabs value={tab} onChange={setTab}>
        <TabList hideBorder>
          <TabList.Item key={Tab.SPAN}>{t('Span Samples')}</TabList.Item>
          <TabList.Item key={Tab.TRACE}>{t('Trace Samples')}</TabList.Item>
        </TabList>
      </Tabs>
      {tab === Tab.SPAN && <SpansTable />}
      {tab === Tab.TRACE && <TracesTable />}
    </Fragment>
  );
}
