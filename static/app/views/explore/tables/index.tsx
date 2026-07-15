import {Fragment, useEffect} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconEdit} from 'sentry/icons/iconEdit';
import {t} from 'sentry/locale';
import {AttributeBreakdownsContent} from 'sentry/views/explore/components/attributeBreakdowns/content';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import type {TracesTableResult} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import {
  useQueryParamsCrossEvents,
  useSetQueryParamsAggregateFields,
  useSetQueryParamsFields,
} from 'sentry/views/explore/queryParams/context';
import {useValidatedSpansTabColumns} from 'sentry/views/explore/spans/hooks/useValidatedSpansTabColumns';
import {AggregateColumnEditorModal} from 'sentry/views/explore/tables/aggregateColumnEditorModal';
import {AggregatesTable} from 'sentry/views/explore/tables/aggregatesTable';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {SpansTable} from 'sentry/views/explore/tables/spansTable';
import {TracesTable} from 'sentry/views/explore/tables/tracesTable/index';

interface BaseExploreTablesProps {
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
  const setAggregateFields = useSetQueryParamsAggregateFields();
  const setFields = useSetQueryParamsFields();

  const {
    aggregateFields: validatedAggregateFields,
    attributes: {
      boolean: validatedBooleanTags,
      number: validatedNumberTags,
      string: validatedStringTags,
    },
    fieldTypes: validatedFieldTypes,
    fields: validatedFields,
    isValidatingColumns,
  } = useValidatedSpansTabColumns(tab);

  const openColumnEditor = () => {
    openModal(
      modalProps => (
        <ColumnEditorModal
          {...modalProps}
          columns={validatedFields}
          onColumnsChange={setFields}
          stringTags={validatedStringTags}
          numberTags={validatedNumberTags}
          booleanTags={validatedBooleanTags}
          requiredTags={['id']}
          validatedFieldTypes={validatedFieldTypes}
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
          columns={validatedAggregateFields.slice()}
          onColumnsChange={setAggregateFields}
          stringTags={validatedStringTags}
          numberTags={validatedNumberTags}
          booleanTags={validatedBooleanTags}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  };

  useEffect(() => {
    if ((tab === Tab.TRACE || tab === Tab.ATTRIBUTE_BREAKDOWNS) && hasCrossEvents) {
      setTab(Tab.SPAN, 'effect');
    }
  }, [hasCrossEvents, setTab, tab]);

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
              <FeatureBadge type="beta" />
            </TabList.Item>
          </TabList>
        </Tabs>
        {tab === Tab.SPAN ? (
          <Button
            disabled={isValidatingColumns}
            onClick={openColumnEditor}
            icon={<IconEdit />}
            size="sm"
          >
            {t('Edit Table')}
          </Button>
        ) : tab === Mode.AGGREGATE ? (
          <Button
            disabled={isValidatingColumns}
            onClick={openAggregateColumnEditor}
            icon={<IconEdit />}
            size="sm"
          >
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
      {tab === Tab.SPAN && (
        <SpansTable
          {...props}
          stringTags={validatedStringTags}
          numberTags={validatedNumberTags}
          booleanTags={validatedBooleanTags}
          validatedFieldTypes={validatedFieldTypes}
        />
      )}
      {tab === Tab.TRACE && <TracesTable {...props} />}
      {tab === Mode.AGGREGATE && (
        <AggregatesTable
          {...props}
          stringTags={validatedStringTags}
          numberTags={validatedNumberTags}
          booleanTags={validatedBooleanTags}
          validatedFieldTypes={validatedFieldTypes}
        />
      )}
      {tab === Tab.ATTRIBUTE_BREAKDOWNS && <AttributeBreakdownsContent />}
    </Fragment>
  );
}
