import {Fragment, useEffect, useMemo} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconEdit} from 'sentry/icons/iconEdit';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {parseFunction} from 'sentry/utils/discover/fields';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';
import {AttributeBreakdownsContent} from 'sentry/views/explore/components/attributeBreakdowns/content';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import type {TracesTableResult} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import type {
  AggregateField,
  WritableAggregateField,
} from 'sentry/views/explore/queryParams/aggregateField';
import {
  useQueryParamsAggregateFields,
  useQueryParamsCrossEvents,
  useQueryParamsFields,
  useSetQueryParamsAggregateFields,
  useSetQueryParamsFields,
} from 'sentry/views/explore/queryParams/context';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {useValidateSpansTab} from 'sentry/views/explore/spans/hooks/useValidateSpansTab';
import {AggregateColumnEditorModal} from 'sentry/views/explore/tables/aggregateColumnEditorModal';
import {AggregatesTable} from 'sentry/views/explore/tables/aggregatesTable';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {SpansTable} from 'sentry/views/explore/tables/spansTable';
import {TracesTable} from 'sentry/views/explore/tables/tracesTable/index';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

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

  const aggregateFields = useQueryParamsAggregateFields();
  const setAggregateFields = useSetQueryParamsAggregateFields();

  const fields = useQueryParamsFields();
  const setFields = useSetQueryParamsFields();

  const {attributes: numberTags} = useSpanItemAttributes({}, 'number');
  const {attributes: stringTags} = useSpanItemAttributes({}, 'string');
  const {attributes: booleanTags} = useSpanItemAttributes({}, 'boolean');
  const {data: validatedColumnsData, isFetching: isValidatingColumns} =
    useValidateSpansTab({
      enabled: tab === Tab.SPAN || tab === Mode.AGGREGATE,
    });
  const {
    validatedBooleanTags,
    validatedAggregateFields,
    validatedFieldTypes,
    validatedFields,
    validatedNumberTags,
    validatedStringTags,
  } = useMemo(
    () =>
      getValidatedColumnEditorData({
        booleanTags,
        aggregateFields,
        fields,
        numberTags,
        stringTags,
        validatedColumnsData,
      }),
    [aggregateFields, booleanTags, fields, numberTags, stringTags, validatedColumnsData]
  );

  useEffect(() => {
    if (tab !== Tab.SPAN || isValidatingColumns) {
      return;
    }

    const fieldsChanged =
      validatedFields.length !== fields.length ||
      validatedFields.some((field, index) => field !== fields[index]);

    if (fieldsChanged) {
      setFields([...validatedFields]);
    }
  }, [fields, isValidatingColumns, setFields, tab, validatedFields]);

  useEffect(() => {
    if (tab !== Mode.AGGREGATE || isValidatingColumns) {
      return;
    }

    const aggregateFieldsChanged =
      validatedAggregateFields.length !== aggregateFields.length ||
      validatedAggregateFields.some((aggregateField, index) => {
        const currentAggregateField = aggregateFields[index];
        if (!currentAggregateField) {
          return true;
        }
        if (isGroupBy(aggregateField) && isGroupBy(currentAggregateField)) {
          return aggregateField.groupBy !== currentAggregateField.groupBy;
        }
        if (!isGroupBy(aggregateField) && !isGroupBy(currentAggregateField)) {
          return aggregateField.yAxis !== currentAggregateField.yAxis;
        }
        return true;
      });

    if (aggregateFieldsChanged) {
      setAggregateFields(validatedAggregateFields.map(serializeAggregateField));
    }
  }, [
    aggregateFields,
    isValidatingColumns,
    setAggregateFields,
    tab,
    validatedAggregateFields,
  ]);

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

function getValidatedColumnEditorData({
  aggregateFields,
  booleanTags,
  fields,
  numberTags,
  stringTags,
  validatedColumnsData,
}: {
  aggregateFields: readonly AggregateField[];
  booleanTags: TagCollection;
  fields: readonly string[];
  numberTags: TagCollection;
  stringTags: TagCollection;
  validatedColumnsData?: EventValidationData;
}) {
  const validatedBooleanTags = {...booleanTags};
  const validatedFieldTypes: Partial<Record<string, FieldValueType>> = {};
  const validatedNumberTags = {...numberTags};
  const validatedStringTags = {...stringTags};
  const invalidFields = new Set<string>();

  for (const item of validatedColumnsData?.field ?? []) {
    if (!item.name) {
      continue;
    }

    if (!item.valid) {
      invalidFields.add(item.name);
      continue;
    }

    if (item.attrType === 'boolean') {
      validatedFieldTypes[item.name] = FieldValueType.BOOLEAN;
      delete validatedNumberTags[item.name];
      delete validatedStringTags[item.name];
      validatedBooleanTags[item.name] ??= {
        key: item.name,
        name: prettifyAttributeName(item.name),
        kind: FieldKind.BOOLEAN,
      };
    }

    if (item.attrType === 'number') {
      validatedFieldTypes[item.name] = FieldValueType.NUMBER;
      delete validatedBooleanTags[item.name];
      delete validatedStringTags[item.name];
      validatedNumberTags[item.name] ??= {
        key: item.name,
        name: prettifyAttributeName(item.name),
        kind: FieldKind.MEASUREMENT,
      };
    }

    if (item.attrType === 'string') {
      validatedFieldTypes[item.name] = FieldValueType.STRING;
      delete validatedBooleanTags[item.name];
      delete validatedNumberTags[item.name];
      validatedStringTags[item.name] ??= {
        key: item.name,
        name: prettifyAttributeName(item.name),
        kind: FieldKind.TAG,
      };
    }
  }

  return {
    validatedBooleanTags,
    validatedAggregateFields: getValidatedAggregateFields({
      aggregateFields,
      invalidFields,
    }),
    validatedFieldTypes,
    validatedFields: fields.filter(field => !invalidFields.has(field)),
    validatedNumberTags,
    validatedStringTags,
  };
}

export function getValidatedAggregateFields({
  aggregateFields,
  invalidFields,
}: {
  aggregateFields: readonly AggregateField[];
  invalidFields: ReadonlySet<string>;
}): AggregateField[] {
  return aggregateFields.filter(aggregateField => {
    if (isGroupBy(aggregateField)) {
      return !invalidFields.has(aggregateField.groupBy);
    }

    if (invalidFields.has(aggregateField.yAxis)) {
      return false;
    }

    return !parseFunction(aggregateField.yAxis)?.arguments.some(
      argument => argument && invalidFields.has(argument)
    );
  });
}

function serializeAggregateField(aggregateField: AggregateField): WritableAggregateField {
  if (isGroupBy(aggregateField)) {
    return aggregateField;
  }
  return aggregateField.serialize();
}
