import type {Dispatch, SetStateAction} from 'react';
import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {TabList, Tabs} from 'sentry/components/tabs';
import {IconTable} from 'sentry/icons/iconTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
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

function useTab(): [Tab, (tab: Tab) => void] {
  const location = useLocation();
  const navigate = useNavigate();

  const tab = useMemo(() => {
    const rawTab = decodeScalar(location.query.table);
    if (rawTab === 'trace') {
      return Tab.TRACE;
    }
    return Tab.SPAN;
  }, [location.query.table]);

  const setTab = useCallback(
    (newTab: Tab) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          table: newTab,
          cursor: undefined,
        },
      });
    },
    [location, navigate]
  );

  return [tab, setTab];
}

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
