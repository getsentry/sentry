import {Fragment, useEffect} from 'react';

import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Tooltip} from '@sentry/scraps/tooltip';

import {openModal} from 'sentry/actionCreators/modal';
import {IconEdit} from 'sentry/icons/iconEdit';
import {t} from 'sentry/locale';
import type {Confidence} from 'sentry/types/organization';
import {AttributeBreakdownsContent} from 'sentry/views/explore/components/attributeBreakdowns/content';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useSpanItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import type {TracesTableResult} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import {
  useQueryParamsAggregateFields,
  useQueryParamsCrossEvents,
  useQueryParamsFields,
  useSetQueryParamsAggregateFields,
  useSetQueryParamsFields,
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
  const {setTab, tab} = props;
  const crossEvents = useQueryParamsCrossEvents();
  const hasCrossEvents = !!crossEvents?.length;

  const aggregateFields = useQueryParamsAggregateFields();
  const setAggregateFields = useSetQueryParamsAggregateFields();

  const fields = useQueryParamsFields();
  const setFields = useSetQueryParamsFields();

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
    if ((tab === Tab.TRACE || tab === Tab.ATTRIBUTE_BREAKDOWNS) && hasCrossEvents) {
      setTab(Tab.SPAN);
    }
  }, [hasCrossEvents, setTab, tab]);

  return (
    <Fragment>
      <Flex justify="between" marginBottom="md" gap="md" wrap="wrap">
        <Tabs value={tab} onChange={setTab} size="sm" disableOverflow>
          <TabList variant="floating">
            <TabList.Item key={Tab.SPAN}>{t('Span Samples')}</TabList.Item>
            <TabList.Item
              key={Tab.TRACE}
              disabled={hasCrossEvents}
              tooltip={{
                title: hasCrossEvents
                  ? t(
                      'Trace samples do not yet work with Cross-Event queries. Use the Spans tab instead.'
                    )
                  : undefined,
              }}
            >
              {t('Trace Samples')}
            </TabList.Item>
            <TabList.Item key={Mode.AGGREGATE}>{t('Aggregates')}</TabList.Item>
            <TabList.Item
              key={Tab.ATTRIBUTE_BREAKDOWNS}
              textValue={t('Attribute Breakdowns')}
              disabled={hasCrossEvents}
            >
              {t('Attribute Breakdowns')}
              <Badge variant="beta">Beta</Badge>
            </TabList.Item>
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
          <Tooltip
            title={
              tab === Tab.TRACE
                ? t('Editing columns is available for span samples only')
                : t('Use the Group By and Visualize controls to change table columns')
            }
          >
            <Button disabled onClick={openColumnEditor} icon={<IconEdit />} size="sm">
              {t('Edit Table')}
            </Button>
          </Tooltip>
        )}
      </Flex>
      {tab === Tab.SPAN && <SpansTable {...props} />}
      {tab === Tab.TRACE && <TracesTable {...props} />}
      {tab === Mode.AGGREGATE && <AggregatesTable {...props} />}
      {tab === Tab.ATTRIBUTE_BREAKDOWNS && <AttributeBreakdownsContent />}
    </Fragment>
  );
}
