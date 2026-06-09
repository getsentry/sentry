import {useCallback, useMemo, useState, type ReactNode} from 'react';
import type {DraggableAttributes} from '@dnd-kit/core';
import type {SyntheticListenerMap} from '@dnd-kit/core/dist/hooks/utilities';
import cloneDeep from 'lodash/cloneDeep';

import {Button, ButtonBar} from '@sentry/scraps/button';
import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DragReorderButton} from 'sentry/components/dnd/dragReorderButton';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {IconCopy, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {parseFunction} from 'sentry/utils/discover/fields';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  type AggregationKey,
} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {usePrevious} from 'sentry/utils/usePrevious';
import {ToolbarVisualizeDropdown} from 'sentry/views/explore/components/toolbar/toolbarVisualize';
import {VisualizeEquation as VisualizeEquationInput} from 'sentry/views/explore/components/toolbar/toolbarVisualize/visualizeEquation';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {updateVisualizeAggregate} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsMode,
  useQueryParamsQuery,
  useQueryParamsVisualizes,
  useSetQueryParams,
  useSetQueryParamsGroupBys,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {isVisualizeEquation, Visualize} from 'sentry/views/explore/queryParams/visualize';
import {CrossEventQueryingDropdown} from 'sentry/views/explore/spans/crossEvents/crossEventQueryingDropdown';
import {SpansTabCrossEventSearchBars} from 'sentry/views/explore/spans/crossEvents/crossEventSearchBars';
import {SamplesModeAggregateFilterWarning} from 'sentry/views/explore/spans/samplesModeAggregateFilterWarning';
import {SettingsDropdown} from 'sentry/views/explore/spans/settingsDropdown';
import type {SpanCard} from 'sentry/views/explore/spans/spanCardsQueryParams';
import {
  MAX_SPAN_CARDS,
  useSpanCards,
} from 'sentry/views/explore/spans/spanCardsQueryParams';
import {ToolbarGroupBy} from 'sentry/views/explore/toolbar/toolbarGroupBy';
import {ToolbarSortBy} from 'sentry/views/explore/toolbar/toolbarSortBy';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {findSuggestedColumns} from 'sentry/views/explore/utils';

interface SpanCardToolbarProps {
  card: SpanCard;
  dragAttributes?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
}

export function SpanCardToolbar({
  card,
  dragAttributes,
  dragListeners,
}: SpanCardToolbarProps) {
  const cards = useSpanCards();
  const canRemove = cards.length > 1;
  const canDuplicate = cards.length < MAX_SPAN_CARDS;

  return (
    <Stack gap="md" padding="md xl" data-test-id="span-card-toolbar">
      <Flex align="center" justify="between" gap="md" wrap="wrap">
        <Flex align="center" gap="sm" minWidth="0">
          {dragListeners ? (
            <DragReorderButton iconSize="sm" {...dragListeners} {...dragAttributes} />
          ) : null}
          <Flex
            width="24px"
            height="24px"
            radius="md"
            background="secondary"
            align="center"
            justify="center"
          >
            <Text size="sm" bold variant="accent">
              {card.label}
            </Text>
          </Flex>
          <Text bold>{isCardEquation(card) ? t('Equation') : t('Span Query')}</Text>
        </Flex>
        <ButtonBar>
          <Button
            size="xs"
            icon={<IconCopy />}
            aria-label={t('Duplicate span card')}
            disabled={!canDuplicate}
            onClick={card.duplicate}
          />
          <Button
            size="xs"
            icon={<IconDelete />}
            aria-label={t('Remove span card')}
            disabled={!canRemove}
            onClick={card.remove}
          />
          <Button size="xs" disabled>
            {t('Save as')}
          </Button>
          <Button size="xs" disabled>
            {t('Export')}
          </Button>
          <SettingsDropdown />
        </ButtonBar>
      </Flex>
      <SpanCardSearch card={card} />
      <Grid
        columns={{
          xs: '1fr',
          lg: 'minmax(260px, 1fr) minmax(260px, 1fr) minmax(220px, 0.8fr)',
        }}
        gap="md"
        align="start"
      >
        <SpanCardVisualizeControl label={card.label} />
        <ToolbarGroupByContainer />
        <ToolbarSortBy />
      </Grid>
      <Stack gap="sm">
        <Flex justify="end">
          <CrossEventQueryingDropdown />
        </Flex>
        <SpansTabCrossEventSearchBars />
      </Stack>
    </Stack>
  );
}

function isCardEquation(card: SpanCard) {
  const visualize = card.queryParams.visualizes[0];
  return visualize ? isVisualizeEquation(visualize) : false;
}

function SpanCardSearch({card}: {card: SpanCard}) {
  const {caseInsensitive, setCaseInsensitive} = card;
  const mode = useQueryParamsMode();
  const fields = useQueryParamsFields();
  const query = useQueryParamsQuery();
  const setQueryParams = useSetQueryParams();
  const {selection} = usePageFilters();

  const {attributes: numberAttributes} = useSpanItemAttributes({}, 'number');
  const {attributes: stringAttributes} = useSpanItemAttributes({}, 'string');
  const {attributes: booleanAttributes} = useSpanItemAttributes({}, 'boolean');

  const search = useMemo(() => new MutableSearch(query), [query]);
  const oldSearch = usePrevious(search);

  const searchQueryBuilderProps = useMemo(
    () => ({
      initialQuery: query,
      onSearch: (newQuery: string) => {
        const newSearch = new MutableSearch(newQuery);
        const suggestedColumns = findSuggestedColumns(newSearch, oldSearch, {
          booleanAttributes,
          numberAttributes,
          stringAttributes,
        });

        const existingFields = new Set(fields);
        const newColumns = suggestedColumns.filter(col => !existingFields.has(col));

        setQueryParams({
          query: newQuery,
          fields: newColumns.length ? [...fields, ...newColumns] : undefined,
        });
      },
      searchSource: 'explore',
      getFilterTokenWarning:
        mode === Mode.SAMPLES
          ? (key: string) => {
              if (ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.includes(key as AggregationKey)) {
                return <SamplesModeAggregateFilterWarning />;
              }
              return;
            }
          : undefined,
      supportedAggregates:
        mode === Mode.SAMPLES ? [] : ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
      replaceRawSearchKeys: ['span.description'],
      matchKeySuggestions: [
        {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
        {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
      ],
      caseInsensitive,
      onCaseInsensitiveClick: (value: true | null) => setCaseInsensitive(Boolean(value)),
    }),
    [
      booleanAttributes,
      caseInsensitive,
      setCaseInsensitive,
      fields,
      mode,
      numberAttributes,
      oldSearch,
      query,
      setQueryParams,
      stringAttributes,
    ]
  );

  const {spanSearchQueryBuilderProviderProps, spanSearchQueryBuilderProps} =
    useSpanSearchQueryBuilderProps(searchQueryBuilderProps);

  return (
    <SearchQueryBuilderProvider {...spanSearchQueryBuilderProviderProps}>
      <TraceItemSearchQueryBuilder
        {...spanSearchQueryBuilderProps}
        autoFocus={selection.projects.length > 0 && query.length === 0}
      />
    </SearchQueryBuilderProvider>
  );
}

function SpanCardVisualizeControl({label}: {label: string}) {
  const visualizes = useQueryParamsVisualizes();
  const setVisualizes = useSetQueryParamsVisualizes();
  const visualize = visualizes[0];

  const setVisualizesWithOp = useCallback(
    (columns: Visualize[]) => {
      const nextVisualize = columns[0] ?? visualize;
      if (nextVisualize) {
        setVisualizes([nextVisualize.serialize()]);
      }
    },
    [setVisualizes, visualize]
  );

  const replaceVisualize = useCallback(
    (newVisualize: Visualize) => {
      setVisualizes([newVisualize.serialize()]);
    },
    [setVisualizes]
  );

  if (!visualize) {
    return null;
  }

  return (
    <DragNDropContext columns={[visualize]} setColumns={setVisualizesWithOp}>
      {() => (
        <Stack gap="sm">
          <Text size="sm" bold>
            {t('Visualize')}
          </Text>
          {isVisualizeEquation(visualize) ? (
            <VisualizeEquationInput
              visualize={visualize}
              onReplace={replaceVisualize}
              label={<VisualizePill label={label} />}
            />
          ) : (
            <SpanCardVisualizeDropdown
              visualize={visualize}
              onReplace={replaceVisualize}
              label={<VisualizePill label={label} />}
            />
          )}
        </Stack>
      )}
    </DragNDropContext>
  );
}

function SpanCardVisualizeDropdown({
  label,
  onReplace,
  visualize,
}: {
  label: ReactNode;
  onReplace: (visualize: Visualize) => void;
  visualize: Visualize;
}) {
  const [search, setSearch] = useState<string | undefined>(undefined);
  const debouncedSearch = useDebouncedValue(search, 200);

  const {attributes: stringTags, isLoading: stringTagsLoading} = useSpanItemAttributes(
    {search: debouncedSearch},
    'string'
  );
  const {attributes: numberTags, isLoading: numberTagsLoading} = useSpanItemAttributes(
    {search: debouncedSearch},
    'number'
  );
  const {attributes: booleanTags, isLoading: booleanTagsLoading} = useSpanItemAttributes(
    {search: debouncedSearch},
    'boolean'
  );

  const aggregateOptions = useMemo(
    () =>
      ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => ({
        label: aggregate,
        value: aggregate,
        textValue: aggregate,
      })),
    []
  );

  const parsedFunction = useMemo(() => parseFunction(visualize.yAxis), [visualize.yAxis]);

  const fieldOptions = useVisualizeFields({
    numberTags,
    stringTags,
    booleanTags,
    parsedFunction,
    traceItemType: TraceItemDataset.SPANS,
  });

  const onChangeAggregate = useCallback(
    (option: SelectOption<SelectKey>) => {
      if (typeof option.value === 'string') {
        const yAxis = updateVisualizeAggregate({
          newAggregate: option.value,
          oldAggregate: parsedFunction?.name,
          oldArguments: parsedFunction?.arguments,
        });
        onReplace(visualize.replace({yAxis}));
      }
    },
    [onReplace, parsedFunction, visualize]
  );

  const onChangeArgument = useCallback(
    (index: number, option: SelectOption<SelectKey>) => {
      if (typeof option.value === 'string') {
        let args = cloneDeep(parsedFunction?.arguments);
        if (args) {
          args[index] = option.value;
        } else {
          args = [option.value];
        }
        const yAxis = `${parsedFunction?.name}(${args.join(',')})`;
        onReplace(visualize.replace({yAxis}));
      }
    },
    [onReplace, parsedFunction, visualize]
  );

  return (
    <ToolbarVisualizeDropdown
      aggregateOptions={aggregateOptions}
      fieldOptions={fieldOptions}
      onChangeAggregate={onChangeAggregate}
      onChangeArgument={onChangeArgument}
      parsedFunction={parsedFunction}
      label={label}
      loading={numberTagsLoading || stringTagsLoading || booleanTagsLoading}
      onSearch={setSearch}
      onClose={() => setSearch(undefined)}
    />
  );
}

function ToolbarGroupByContainer() {
  const groupBys = useQueryParamsGroupBys();
  const setGroupBys = useSetQueryParamsGroupBys();
  return <ToolbarGroupBy groupBys={groupBys} setGroupBys={setGroupBys} />;
}

function VisualizePill({label}: {label: string}) {
  return (
    <Flex
      width="24px"
      height="36px"
      radius="md"
      background="secondary"
      align="center"
      justify="center"
    >
      <Text size="sm" bold variant="accent">
        {label}
      </Text>
    </Flex>
  );
}
