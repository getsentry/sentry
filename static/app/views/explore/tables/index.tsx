import type {Dispatch, SetStateAction} from 'react';
import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {TabList, Tabs} from 'sentry/components/tabs';
import {IconTable} from 'sentry/icons/iconTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';
import {AggregatesTable} from 'sentry/views/explore/tables/aggregatesTable';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {SpansTable} from 'sentry/views/explore/tables/spansTable';
import {TracesTable} from 'sentry/views/explore/tables/tracesTable/index';

interface ExploreTablesProps {
  setError: Dispatch<SetStateAction<string>>;
}

export function ExploreTables({setError}: ExploreTablesProps) {
  const [resultMode] = useResultMode();

  return (
    <Fragment>
      {resultMode === 'aggregate' && <ExploreAggregatesTable setError={setError} />}
      {resultMode === 'samples' && <ExploreSamplesTable setError={setError} />}
    </Fragment>
  );
}

function ExploreAggregatesTable({setError}: ExploreTablesProps) {
  return <AggregatesTable setError={setError} />;
}

function ExploreSamplesTable({setError}: ExploreTablesProps) {
  const [tab, setTab] = useTab();

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
      {tab === Tab.SPAN && <SpansTable setError={setError} />}
      {tab === Tab.TRACE && <TracesTable setError={setError} />}
    </Fragment>
  );
}

const SamplesTableHeader = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;
