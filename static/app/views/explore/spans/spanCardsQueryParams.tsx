import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type {Location} from 'history';

import {defined} from 'sentry/utils/defined';
import type {Sort} from 'sentry/utils/discover/fields';
import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import type {CrossEvent} from 'sentry/views/explore/queryParams/crossEvent';
import {isCrossEventType} from 'sentry/views/explore/queryParams/crossEvent';
import {isGroupBy, type GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {
  ReadableQueryParams,
  type ExploreTable,
} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  isBaseVisualize,
  isVisualize,
  isVisualizeEquation,
  isVisualizeFunction,
  Visualize,
  VisualizeEquation,
  VisualizeFunction,
  type BaseVisualize,
} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';
import {
  defaultAggregateSortBys,
  defaultFields,
  defaultGroupBys,
  defaultSortBys,
  defaultVisualizes,
  getReadableQueryParamsFromLocation,
} from 'sentry/views/explore/spans/spansQueryParams';
import {
  getFunctionLabel,
  getVisualizeLabel,
} from 'sentry/views/explore/toolbar/toolbarVisualize';

const SPAN_CARD_KEY = 'span';
export const MAX_SPAN_CARDS = 8;

type CaseInsensitive = true | undefined;

export interface BaseSpanCard {
  queryParams: ReadableQueryParams;
  caseInsensitive?: CaseInsensitive;
}

export interface SpanCard extends BaseSpanCard {
  duplicate: () => void;
  label: string;
  remove: () => void;
  setCaseInsensitive: (caseInsensitive: boolean) => void;
  setQueryParams: (queryParams: WritableQueryParams) => void;
}

interface SpanCardsContextValue {
  addCard: (type?: 'aggregate' | 'equation') => void;
  cards: SpanCard[];
  reorderCards: (cards: BaseSpanCard[], oldIndex: number, newIndex: number) => void;
}

const SpanCardsContext = createContext<SpanCardsContextValue | undefined>(undefined);

export function useSpanCards() {
  const context = useContext(SpanCardsContext);
  if (!context) {
    throw new Error('useSpanCards must be used inside SpanCardsQueryParamsProvider');
  }
  return context.cards;
}

export function useAddSpanCard() {
  const context = useContext(SpanCardsContext);
  if (!context) {
    throw new Error('useAddSpanCard must be used inside SpanCardsQueryParamsProvider');
  }
  return context.addCard;
}

export function useReorderSpanCards() {
  const context = useContext(SpanCardsContext);
  if (!context) {
    throw new Error(
      'useReorderSpanCards must be used inside SpanCardsQueryParamsProvider'
    );
  }
  return context.reorderCards;
}

export function useHasAnySpanCardCrossEvents() {
  const cards = useSpanCards();
  return cards.some(card => card.queryParams.crossEvents?.length);
}

function isSameLocation(a: Location, b: Location): boolean {
  if (a.pathname !== b.pathname) {
    return false;
  }
  return JSON.stringify(a.query) === JSON.stringify(b.query);
}

interface SpanCardsQueryParamsProviderProps {
  children: ReactNode;
}

export function SpanCardsQueryParamsProvider({
  children,
}: SpanCardsQueryParamsProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const locationRef = useRef(location);
  locationRef.current = location;

  const baseCards = useMemo(() => getSpanCardsFromLocation(location), [location]);
  const labels = useStableSpanLabels(baseCards);

  const setBaseCards = useCallback(
    (nextCards: BaseSpanCard[]) => {
      const target = getTargetWithSpanCards(
        locationRef.current,
        nextCards.slice(0, MAX_SPAN_CARDS)
      );
      if (!isSameLocation(locationRef.current, target)) {
        navigate(target);
      }
    },
    [navigate]
  );

  const value = useMemo((): SpanCardsContextValue => {
    const labeledCards = baseCards.map((card, index) => ({
      ...card,
      label: labels.getLabel(index),
    }));

    function setQueryParamsForIndex(index: number) {
      return (queryParams: WritableQueryParams) => {
        const nextCards = labeledCards.map((card, cardIndex) => {
          if (cardIndex !== index) {
            return card;
          }
          return {
            queryParams: applyWritableQueryParams(card.queryParams, queryParams),
            caseInsensitive: card.caseInsensitive,
          };
        });
        setBaseCards(nextCards);
      };
    }

    function setCaseInsensitiveForIndex(index: number) {
      return (caseInsensitive: boolean) => {
        const nextCaseInsensitive = toCaseInsensitive(caseInsensitive);
        const nextCards = labeledCards.map((card, cardIndex) => {
          if (cardIndex !== index) {
            return card;
          }
          return {
            queryParams: card.queryParams,
            caseInsensitive: nextCaseInsensitive,
          };
        });
        setBaseCards(nextCards);
      };
    }

    function removeCardForIndex(index: number) {
      return () => {
        if (labeledCards.length <= 1) {
          return;
        }
        labels.remove(index);
        setBaseCards(labeledCards.filter((_, cardIndex) => cardIndex !== index));
      };
    }

    function duplicateCardForIndex(index: number) {
      return () => {
        if (labeledCards.length >= MAX_SPAN_CARDS) {
          return;
        }
        const source =
          labeledCards[index] ?? labeledCards.at(-1) ?? createDefaultSpanCard();
        const duplicate = resetCursors(source);
        labels.insert(
          index + 1,
          getNextSpanLabel(labeledCards, getSpanCardType(duplicate))
        );
        const nextCards: BaseSpanCard[] = [
          ...labeledCards.slice(0, index + 1),
          duplicate,
          ...labeledCards.slice(index + 1),
        ];
        setBaseCards(nextCards);
      };
    }

    function addCard(type: 'aggregate' | 'equation' = 'aggregate') {
      if (labeledCards.length >= MAX_SPAN_CARDS) {
        return;
      }

      const lastCard = labeledCards.at(-1);
      const nextCard =
        type === 'equation'
          ? createDefaultSpanCard('equation')
          : resetCursors(lastCard ?? createDefaultSpanCard());
      const nextLabel = getNextSpanLabel(labeledCards, type);
      labels.insert(labeledCards.length, nextLabel);
      const nextCards: BaseSpanCard[] = [...labeledCards, nextCard];
      setBaseCards(nextCards);
    }

    function reorderCards(cards: BaseSpanCard[], oldIndex: number, newIndex: number) {
      labels.move(oldIndex, newIndex);
      setBaseCards(cards);
    }

    return {
      addCard,
      reorderCards,
      cards: labeledCards.map((card, index) => ({
        ...card,
        setQueryParams: setQueryParamsForIndex(index),
        setCaseInsensitive: setCaseInsensitiveForIndex(index),
        remove: removeCardForIndex(index),
        duplicate: duplicateCardForIndex(index),
      })),
    };
  }, [baseCards, labels, setBaseCards]);

  return <SpanCardsContext value={value}>{children}</SpanCardsContext>;
}

interface SpanCardQueryParamsProviderProps {
  card: SpanCard;
  children: ReactNode;
}

export function SpanCardQueryParamsProvider({
  card,
  children,
}: SpanCardQueryParamsProviderProps) {
  return (
    <QueryParamsContextProvider
      isUsingDefaultFields={isUsingDefaultFields(card.queryParams.fields)}
      queryParams={card.queryParams}
      setQueryParams={card.setQueryParams}
      shouldManageFields
    >
      {children}
    </QueryParamsContextProvider>
  );
}

function toCaseInsensitive(enabled: boolean): CaseInsensitive {
  return enabled ? true : undefined;
}

function isUsingDefaultFields(fields: readonly string[]): boolean {
  const defaults = defaultFields();
  return (
    fields.length === defaults.length &&
    fields.every((field, index) => field === defaults[index])
  );
}

function applyWritableQueryParams(
  queryParams: ReadableQueryParams,
  writable: WritableQueryParams
): ReadableQueryParams {
  const aggregateFields =
    writable.aggregateFields === null
      ? defaultAggregateFieldsForCard(queryParams.visualizes[0])
      : (writable.aggregateFields?.flatMap(parseAggregateField) ??
        queryParams.aggregateFields);

  return queryParams.replace({
    aggregateCursor:
      writable.aggregateCursor === null
        ? ''
        : (writable.aggregateCursor ?? queryParams.aggregateCursor),
    aggregateFields,
    aggregateSortBys:
      writable.aggregateSortBys === null
        ? defaultAggregateSortBys([...aggregateFields])
        : (writable.aggregateSortBys ?? queryParams.aggregateSortBys),
    cursor: writable.cursor === null ? '' : (writable.cursor ?? queryParams.cursor),
    extrapolate: writable.extrapolate ?? queryParams.extrapolate,
    fields:
      writable.fields === null
        ? defaultFields()
        : (writable.fields ?? queryParams.fields),
    interval:
      writable.interval === null
        ? undefined
        : (writable.interval ?? queryParams.interval),
    mode: writable.mode ?? queryParams.mode,
    query: writable.query === null ? '' : (writable.query ?? queryParams.query),
    sortBys:
      writable.sortBys === null
        ? defaultSortBys(queryParams.fields)
        : (writable.sortBys ?? queryParams.sortBys),
    crossEvents:
      writable.crossEvents === null
        ? undefined
        : writable.crossEvents
          ? [...writable.crossEvents]
          : queryParams.crossEvents,
    table: writable.table === null ? undefined : (writable.table ?? queryParams.table),
  });
}

function getTargetWithSpanCards(location: Location, cards: BaseSpanCard[]): Location {
  const target: Location = {...location, query: {...location.query}};

  for (const key of LEGACY_SPAN_QUERY_KEYS) {
    delete target.query[key];
  }

  target.query[SPAN_CARD_KEY] = cards.map(card =>
    JSON.stringify(serializeSpanCard(card))
  );
  return target;
}

const LEGACY_SPAN_QUERY_KEYS = [
  'aggregateCursor',
  'aggregateField',
  'aggregateSort',
  'caseInsensitive',
  'crossEvents',
  'cursor',
  'extrapolate',
  'field',
  'groupBy',
  'interval',
  'mode',
  'query',
  'sort',
  'table',
  'visualize',
];

interface SerializedSpanCard {
  aggregateFields: Array<GroupBy | BaseVisualize>;
  aggregateSortBys: Sort[];
  crossEvents: CrossEvent[];
  cursor: string;
  extrapolate: boolean;
  fields: string[];
  mode: Mode;
  query: string;
  sortBys: Sort[];
  v: 1;
  aggregateCursor?: string;
  caseInsensitive?: '1';
  interval?: string;
  table?: ExploreTable;
}

function serializeSpanCard(card: BaseSpanCard): SerializedSpanCard {
  const {queryParams} = card;
  return {
    v: 1,
    query: queryParams.query,
    aggregateFields: queryParams.aggregateFields.map(aggregateField => {
      if (isVisualize(aggregateField)) {
        return aggregateField.serialize();
      }
      return aggregateField;
    }),
    aggregateSortBys: [...queryParams.aggregateSortBys],
    fields: [...queryParams.fields],
    sortBys: [...queryParams.sortBys],
    mode: queryParams.mode,
    table: queryParams.table,
    interval: queryParams.interval,
    crossEvents: queryParams.crossEvents ? [...queryParams.crossEvents] : [],
    cursor: queryParams.cursor,
    aggregateCursor: queryParams.aggregateCursor,
    extrapolate: queryParams.extrapolate,
    caseInsensitive: card.caseInsensitive ? '1' : undefined,
  };
}

function getSpanCardsFromLocation(location: Location): BaseSpanCard[] {
  const rawSpanCards = decodeList(location.query[SPAN_CARD_KEY]);
  if (rawSpanCards.length > 0) {
    const cards = rawSpanCards.flatMap(parseSerializedSpanCard).slice(0, MAX_SPAN_CARDS);
    return cards.length > 0 ? cards : [createDefaultSpanCard()];
  }

  return getLegacySpanCardsFromLocation(location).slice(0, MAX_SPAN_CARDS);
}

function parseSerializedSpanCard(raw: string): BaseSpanCard[] {
  let value: any;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!defined(value) || typeof value !== 'object') {
    return [];
  }

  const fields = parseFields(value.fields);
  const sortBys = parseSortBys(value.sortBys, fields);
  const mode = value.mode === Mode.AGGREGATE ? Mode.AGGREGATE : Mode.SAMPLES;
  const aggregateFields = parseAggregateFields(value.aggregateFields);
  const visualizes = aggregateFields.filter(isVisualize);
  const groupBys = getGroupBysOrDefault(aggregateFields);
  const table = parseTable(value.table);
  const crossEvents = parseCrossEvents(value.crossEvents);
  const caseInsensitive = toCaseInsensitive(value.caseInsensitive === '1');

  const cards = (visualizes.length ? visualizes : defaultVisualizes()).map(visualize => {
    const cardAggregateFields = [...groupBys, visualize];
    return {
      caseInsensitive,
      queryParams: new ReadableQueryParams({
        aggregateCursor:
          typeof value.aggregateCursor === 'string' ? value.aggregateCursor : '',
        aggregateFields: cardAggregateFields,
        aggregateSortBys: parseAggregateSortBys(
          value.aggregateSortBys,
          cardAggregateFields
        ),
        cursor: typeof value.cursor === 'string' ? value.cursor : '',
        extrapolate: typeof value.extrapolate === 'boolean' ? value.extrapolate : true,
        fields,
        interval: typeof value.interval === 'string' ? value.interval : undefined,
        mode,
        query: typeof value.query === 'string' ? value.query : '',
        sortBys,
        table,
        crossEvents,
      }),
    };
  });

  return cards;
}

function getLegacySpanCardsFromLocation(location: Location): BaseSpanCard[] {
  const queryParams = getReadableQueryParamsFromLocation(location);
  const caseInsensitive = toCaseInsensitive(
    decodeScalar(location.query.caseInsensitive) === '1'
  );
  const groupBys = getGroupBysOrDefault([...queryParams.aggregateFields]);
  const visualizes = queryParams.visualizes.length
    ? queryParams.visualizes
    : defaultVisualizes();

  return visualizes.map(visualize => {
    const aggregateFields = [...groupBys, visualize];
    return {
      caseInsensitive,
      queryParams: queryParams.replace({
        aggregateFields,
        aggregateSortBys: parseAggregateSortBys(
          queryParams.aggregateSortBys,
          aggregateFields
        ),
      }),
    };
  });
}

function createDefaultSpanCard(
  type: 'aggregate' | 'equation' = 'aggregate'
): BaseSpanCard {
  const visualize =
    type === 'equation'
      ? new VisualizeEquation(EQUATION_PREFIX)
      : new VisualizeFunction(defaultVisualizes()[0].yAxis);
  const aggregateFields = defaultAggregateFieldsForCard(visualize);

  return {
    queryParams: new ReadableQueryParams({
      aggregateCursor: '',
      aggregateFields,
      aggregateSortBys: defaultAggregateSortBys(aggregateFields),
      cursor: '',
      extrapolate: true,
      fields: defaultFields(),
      mode: type === 'equation' ? Mode.AGGREGATE : Mode.SAMPLES,
      query: '',
      sortBys: defaultSortBys(defaultFields()),
      table: type === 'equation' ? undefined : 'span',
    }),
  };
}

function defaultAggregateFieldsForCard(
  visualize = defaultVisualizes()[0]
): Array<GroupBy | Visualize> {
  return [...defaultGroupBys(), visualize];
}

function resetCursors(card: BaseSpanCard): BaseSpanCard {
  return {
    ...card,
    queryParams: card.queryParams.replace({cursor: '', aggregateCursor: ''}),
  };
}

function parseAggregateFields(value: unknown): Array<GroupBy | Visualize> {
  if (!Array.isArray(value)) {
    return defaultAggregateFieldsForCard();
  }

  const aggregateFields = value.flatMap(parseAggregateField);
  return aggregateFields.length ? aggregateFields : defaultAggregateFieldsForCard();
}

function parseAggregateField(value: unknown): Array<GroupBy | Visualize> {
  if (isGroupBy(value)) {
    return [value];
  }

  if (isBaseVisualize(value)) {
    return Visualize.fromJSON(value);
  }

  return [];
}

function getGroupBysOrDefault(aggregateFields: Array<GroupBy | Visualize>): GroupBy[] {
  const groupBys = aggregateFields.filter(isGroupBy);
  return groupBys.length ? groupBys : defaultGroupBys();
}

function parseFields(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(field => typeof field === 'string')) {
    return defaultFields();
  }
  return value;
}

function parseSortBys(value: unknown, fields: string[]): Sort[] {
  if (!Array.isArray(value)) {
    return defaultSortBys(fields);
  }

  const sortBys = value.filter(isSort);
  if (!sortBys.length || sortBys.some(sort => !fields.includes(sort.field))) {
    return defaultSortBys(fields);
  }
  return sortBys;
}

function parseAggregateSortBys(
  value: unknown,
  aggregateFields: Array<GroupBy | Visualize>
): Sort[] {
  if (!Array.isArray(value)) {
    return defaultAggregateSortBys(aggregateFields);
  }

  const sortBys = value.filter(isSort);
  if (
    !sortBys.length ||
    sortBys.some(sort => !isValidAggregateSort(sort, aggregateFields))
  ) {
    return defaultAggregateSortBys(aggregateFields);
  }
  return sortBys;
}

function isSort(value: unknown): value is Sort {
  return (
    value !== null &&
    defined(value) &&
    typeof value === 'object' &&
    'field' in value &&
    typeof value.field === 'string' &&
    'kind' in value &&
    (value.kind === 'asc' || value.kind === 'desc')
  );
}

function isValidAggregateSort(
  sort: Sort,
  aggregateFields: Array<GroupBy | Visualize>
): boolean {
  return aggregateFields.some(aggregateField => {
    if (isGroupBy(aggregateField)) {
      return aggregateField.groupBy === sort.field;
    }
    return aggregateField.yAxis === sort.field;
  });
}

function parseTable(value: unknown): ExploreTable | undefined {
  return value === 'span' || value === 'trace' || value === 'attribute_breakdowns'
    ? value
    : undefined;
}

function parseCrossEvents(value: unknown): CrossEvent[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const crossEvents = value.filter(isCrossEvent).slice(0, 2);
  return crossEvents.length ? crossEvents : undefined;
}

function isCrossEvent(value: unknown): value is CrossEvent {
  if (
    value === null ||
    !defined(value) ||
    typeof value !== 'object' ||
    !('query' in value) ||
    typeof value.query !== 'string' ||
    !('type' in value) ||
    typeof value.type !== 'string' ||
    !isCrossEventType(value.type)
  ) {
    return false;
  }

  if (value.type === 'metrics') {
    return 'metric' in value && isTraceMetric(value.metric);
  }

  return true;
}

function isTraceMetric(value: unknown): value is TraceMetric {
  if (value === null || !defined(value) || typeof value !== 'object') {
    return false;
  }
  const unit = 'unit' in value ? value.unit : undefined;
  return (
    'name' in value &&
    typeof value.name === 'string' &&
    'type' in value &&
    typeof value.type === 'string' &&
    (unit === undefined || unit === null || typeof unit === 'string')
  );
}

function getSpanCardType(card: BaseSpanCard): 'aggregate' | 'equation' {
  const visualize = card.queryParams.visualizes[0];
  return visualize && isVisualizeEquation(visualize) ? 'equation' : 'aggregate';
}

function assignSequentialLabels(cards: BaseSpanCard[]): string[] {
  let nextMetricIndex = 0;
  let nextEquationIndex = 1;
  return cards.map(card => {
    const visualize = card.queryParams.visualizes[0];
    const isEquation = visualize ? isVisualizeEquation(visualize) : false;
    return getVisualizeLabel(
      isEquation ? nextEquationIndex++ : nextMetricIndex++,
      isEquation
    );
  });
}

function getNextSpanLabel(cards: BaseSpanCard[], type: 'aggregate' | 'equation'): string {
  const isEquation = type === 'equation';
  const queryFilter = isEquation ? isVisualizeEquation : isVisualizeFunction;
  const relevantCards = cards.filter(card => {
    const visualize = card.queryParams.visualizes[0];
    return visualize ? queryFilter(visualize) : false;
  });

  if (relevantCards.length === 0) {
    return getVisualizeLabel(isEquation ? 1 : 0, isEquation);
  }

  const maxIndex = Math.max(
    ...relevantCards.map((card, index) => {
      const label =
        'label' in card && typeof card.label === 'string' ? card.label : undefined;
      if (!label) {
        return index;
      }
      return isEquation ? parseEquationIndex(label) : parseFunctionIndex(label);
    })
  );
  return getVisualizeLabel(maxIndex + 1, isEquation);
}

function parseFunctionIndex(label: string): number {
  return label.charCodeAt(0) - 'A'.charCodeAt(0);
}

function parseEquationIndex(label: string): number {
  return parseInt(label.slice(1), 10) || 0;
}

function useStableSpanLabels(cards: BaseSpanCard[]) {
  const labelsRef = useRef<string[]>([]);

  if (labelsRef.current.length !== cards.length) {
    labelsRef.current = assignSequentialLabels(cards);
  }

  return useMemo(
    () => ({
      getLabel(index: number): string {
        return labelsRef.current[index] ?? getFunctionLabel(index);
      },
      insert(position: number, label: string) {
        labelsRef.current = labelsRef.current.toSpliced(position, 0, label);
      },
      remove(position: number) {
        labelsRef.current = labelsRef.current.filter((_, index) => index !== position);
      },
      move(from: number, to: number) {
        if (
          from === to ||
          from < 0 ||
          to < 0 ||
          from >= labelsRef.current.length ||
          to >= labelsRef.current.length
        ) {
          return;
        }
        const next = [...labelsRef.current];
        const [label] = next.splice(from, 1);
        if (!label) {
          return;
        }
        next.splice(to, 0, label);
        labelsRef.current = next;
      },
    }),
    []
  );
}
