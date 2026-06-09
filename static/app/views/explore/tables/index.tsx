import {Fragment, useEffect} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconEdit} from 'sentry/icons/iconEdit';
import {t} from 'sentry/locale';
import type {Confidence} from 'sentry/types/organization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import type {TracesTableResult} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {
  useQueryParamsAggregateFields,
  useQueryParamsCrossEvents,
  useQueryParamsFields,
  useQueryParamsVisualizes,
  useSetQueryParamsAggregateFields,
  useSetQueryParamsFields,
} from 'sentry/views/explore/queryParams/context';
import {isVisualizeEquation} from 'sentry/views/explore/queryParams/visualize';
import {AggregateColumnEditorModal} from 'sentry/views/explore/tables/aggregateColumnEditorModal';
import {AggregatesTable} from 'sentry/views/explore/tables/aggregatesTable';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {SpansTable} from 'sentry/views/explore/tables/spansTable';
import {TracesTable} from 'sentry/views/explore/tables/tracesTable/index';

interface BaseExploreTablesProps {
  confidences: Confidence[];
  setTab: (tab: Mode | Tab, reason: 'click' | 'effect') => void;
  tab: Mode | Tab;
}

interface ExploreTablesProps extends BaseExploreTablesProps {
  aggregatesTableResult: AggregatesTableResult;
  spansTableResult: SpansTableResult;
  tracesTableResult: TracesTableResult;
}

export function ExploreTables(props: ExploreTablesProps) {
  const {openModal} = useModal();

  const {setTab, tab} = props;
  const crossEvents = useQueryParamsCrossEvents();
  const hasCrossEvents = !!crossEvents?.length;

  const aggregateFields = useQueryParamsAggregateFields();
  const setAggregateFields = useSetQueryParamsAggregateFields();

  const fields = useQueryParamsFields();
  const setFields = useSetQueryParamsFields();
  const visualizes = useQueryParamsVisualizes();
  const isEquation = visualizes.some(isVisualizeEquation);

  const {attributes: numberTags} = useSpanItemAttributes({}, 'number');
  const {attributes: stringTags} = useSpanItemAttributes({}, 'string');
  const {attributes: booleanTags} = useSpanItemAttributes({}, 'boolean');

  const openColumnEditor = () => {
    openModal(
      modalProps => (
        <ColumnEditorModal
          {...modalProps}
          columns={fields}
          onColumnsChange={setFields}
          stringTags={stringTags}
          numberTags={numberTags}
          booleanTags={booleanTags}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  };

  const openAggregateColumnEditor = () => {
    openModal(
      modalProps => (
        <AggregateColumnEditorModal
          {...modalProps}
          columns={aggregateFields.slice()}
          onColumnsChange={setAggregateFields}
          stringTags={stringTags}
          numberTags={numberTags}
          booleanTags={booleanTags}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  };

  useEffect(() => {
    if (isEquation && (tab === Tab.TRACE || tab === Tab.SPAN)) {
      setTab(Mode.AGGREGATE, 'effect');
      return;
    }

    if ((tab === Tab.TRACE && hasCrossEvents) || tab === Tab.ATTRIBUTE_BREAKDOWNS) {
      setTab(Tab.SPAN, 'effect');
    }
  }, [hasCrossEvents, isEquation, setTab, tab]);

  return (
    <Fragment>
      <Flex justify="between" marginBottom="md" gap="md" wrap="wrap">
        <Tabs
          value={tab}
          onChange={newTab => setTab(newTab, 'click')}
          size="sm"
          disableOverflow
        >
          <TabList variant="floating">
            <TabList.Item
              key={Tab.SPAN}
              disabled={isEquation}
              tooltip={{
                title: isEquation
                  ? t('Span samples are not available for equations')
                  : undefined,
              }}
            >
              {t('Span Samples')}
            </TabList.Item>
            <TabList.Item
              key={Tab.TRACE}
              disabled={hasCrossEvents || isEquation}
              tooltip={{
                title: isEquation
                  ? t('Trace samples are not available for equations')
                  : hasCrossEvents
                    ? t(
                        'Trace samples do not yet work with Cross-Event queries. Use the Spans tab instead.'
                      )
                    : undefined,
              }}
            >
              {t('Trace Samples')}
            </TabList.Item>
            <TabList.Item key={Mode.AGGREGATE}>{t('Aggregates')}</TabList.Item>
          </TabList>
        </Tabs>
        {tab === Tab.SPAN ? (
          <Button onClick={openColumnEditor} icon={<IconEdit />} size="sm">
            {t('Edit Table')}
          </Button>
        ) : tab === Mode.AGGREGATE ? (
          <Button onClick={openAggregateColumnEditor} icon={<IconEdit />} size="sm">
            {t('Edit Table')}
          </Button>
        ) : (
          <Tooltip title={t('Editing columns is available for span samples only')}>
            <Button disabled onClick={openColumnEditor} icon={<IconEdit />} size="sm">
              {t('Edit Table')}
            </Button>
          </Tooltip>
        )}
      </Flex>
      {tab === Tab.SPAN && <SpansTable {...props} />}
      {tab === Tab.TRACE && <TracesTable {...props} />}
      {tab === Mode.AGGREGATE && <AggregatesTable {...props} />}
    </Fragment>
  );
}
