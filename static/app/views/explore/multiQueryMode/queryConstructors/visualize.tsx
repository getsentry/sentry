import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Tooltip} from '@sentry/scraps/tooltip';

import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {updateVisualizeAggregate} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {
  useUpdateQueryAtIndex,
  type ReadableExploreQueryParts,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {
  Section,
  SectionHeader,
  SectionLabel,
} from 'sentry/views/explore/multiQueryMode/queryConstructors/styles';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  applyConditionalFilter,
  buildConditionalAggregate,
  parseConditionalAggregate,
  supportsConditionalAggregateFilter,
} from 'sentry/views/explore/utils/conditionalAggregate';
import {sortSearchedAttributes} from 'sentry/views/explore/utils/sortSearchedAttributes';

type Props = {
  index: number;
  query: ReadableExploreQueryParts;
};

export function VisualizeSection({query, index}: Props) {
  const {selection} = usePageFilters();
  const {attributes: stringTags} = useSpanItemAttributes({}, 'string');
  const {attributes: numberTags} = useSpanItemAttributes({}, 'number');
  const {attributes: booleanTags} = useSpanItemAttributes({}, 'boolean');

  const yAxis = query.yAxes.find(axis => defined(parseConditionalAggregate(axis))) ?? '';
  const conditionalAggregate = useMemo(() => parseConditionalAggregate(yAxis), [yAxis]);

  const parsedFunction = useMemo(() => {
    if (!conditionalAggregate) {
      return null;
    }
    return {
      name: conditionalAggregate.name,
      arguments: conditionalAggregate.arguments,
    };
  }, [conditionalAggregate]);

  const options = useVisualizeFields({
    numberTags,
    stringTags,
    booleanTags,
    parsedFunction,
    traceItemType: TraceItemDataset.SPANS,
  });

  const updateYAxis = useUpdateQueryAtIndex(index);

  const aggregateOptions: Array<SelectOption<string>> = useMemo(() => {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => {
      return {
        label: aggregate,
        value: aggregate,
        textValue: aggregate,
      };
    });
  }, []);

  const handleFilterSearch = useCallback(
    (filter: string) => {
      if (!parsedFunction) {
        return;
      }
      updateYAxis({
        yAxes: [
          buildConditionalAggregate({
            name: parsedFunction.name,
            arguments: parsedFunction.arguments,
            filter,
          }),
        ],
      });
    },
    [parsedFunction, updateYAxis]
  );

  const showFilterSearchBar = supportsConditionalAggregateFilter(
    parsedFunction?.name ?? ''
  );

  const {spanSearchQueryBuilderProps} = useSpanSearchQueryBuilderProps({
    projects: selection.projects,
    initialQuery: conditionalAggregate?.filter ?? '',
    onSearch: handleFilterSearch,
    searchSource: 'explore',
    placeholder: t('Filter spans for this series'),
  });

  return (
    <Fragment>
      <Section data-test-id={`section-visualize-${index}`}>
        <SectionHeader>
          <Tooltip
            title={t(
              'Primary metric that appears in your chart. You can also overlay a series onto an existing chart or add an equation.'
            )}
          >
            <SectionLabel>{t('Visualize')}</SectionLabel>
          </Tooltip>
        </SectionHeader>
        <StyledPageFilterBar>
          <CompactSelect
            options={aggregateOptions}
            value={parsedFunction?.name ?? ''}
            onChange={newAggregate => {
              const newYAxis = updateVisualizeAggregate({
                newAggregate: newAggregate.value,
                oldAggregate: parsedFunction!.name,
                oldArguments: parsedFunction!.arguments,
              });
              const filter = supportsConditionalAggregateFilter(newAggregate.value)
                ? (conditionalAggregate?.filter ?? '')
                : '';
              updateYAxis({yAxes: [applyConditionalFilter(newYAxis, filter)]});
            }}
          />
          <CompactSelect
            search={{
              highlight: true,
              filter: (option, searchText) => {
                return sortSearchedAttributes({
                  fieldDefinitionType: TraceItemDataset.SPANS,
                  option,
                  searchText,
                });
              },
            }}
            options={options}
            value={parsedFunction?.arguments?.[0] ?? ''}
            onChange={newField => {
              updateYAxis({
                yAxes: [
                  buildConditionalAggregate({
                    name: parsedFunction!.name,
                    arguments: [newField.value],
                    filter: conditionalAggregate?.filter ?? '',
                  }),
                ],
              });
            }}
            disabled={options.length === 1}
          />
        </StyledPageFilterBar>
      </Section>
      {showFilterSearchBar ? (
        <FilterSearchBar data-test-id={`section-visualize-filter-${index}`}>
          <TraceItemSearchQueryBuilder {...spanSearchQueryBuilderProps} />
        </FilterSearchBar>
      ) : null}
    </Fragment>
  );
}

const FilterSearchBar = styled('div')`
  /* Sit on the second row of DropDownGrid and span Visualize → SortBy so the
     filter fills the whitespace under GroupBy/SortBy (menu stays in column 4). */
  grid-column: 1 / 4;
  grid-row: 2;
  min-width: 0;
  width: 100%;
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  & > * {
    min-width: 0;
    flex-grow: 1;
    flex-shrink: 1;
    flex-basis: max-content;

    /* Prevent agg function selector from shrinking */
    &:first-child {
      flex-shrink: 0;
    }

    /* Prevent date filter from shrinking below 6.5rem */
    &:last-child {
      min-width: 4rem;
    }
  }
`;
