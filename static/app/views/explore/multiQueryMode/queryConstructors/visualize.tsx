import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Tooltip} from '@sentry/scraps/tooltip';

import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {parseFunction} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  DEFAULT_VISUALIZATION_AGGREGATE,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
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
import {MAX_VISUALIZES} from 'sentry/views/explore/queryParams/visualize';
import {hasMultiAggregateCharts} from 'sentry/views/explore/spans/sharedChartAggregates';
import {AggregateMultiSelect} from 'sentry/views/explore/toolbar/toolbarVisualize';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {sortSearchedAttributes} from 'sentry/views/explore/utils/sortSearchedAttributes';

type Props = {
  index: number;
  query: ReadableExploreQueryParts;
};

export function VisualizeSection({query, index}: Props) {
  const organization = useOrganization();
  const {attributes: stringTags} = useSpanItemAttributes({}, 'string');
  const {attributes: numberTags} = useSpanItemAttributes({}, 'number');
  const {attributes: booleanTags} = useSpanItemAttributes({}, 'boolean');

  const parsedFunction = findFirstFunction(query.yAxes);

  const options = useVisualizeFields({
    numberTags,
    stringTags,
    booleanTags,
    parsedFunction,
    traceItemType: TraceItemDataset.SPANS,
  });

  const updateYAxis = useUpdateQueryAtIndex(index);

  const multiAggregateCharts = hasMultiAggregateCharts(organization);

  const selectedAggregates = useMemo(
    () =>
      query.yAxes
        .map(yAxis => parseFunction(yAxis)?.name)
        .filter((name): name is string => defined(name)),
    [query.yAxes]
  );

  const onChangeAggregates = (newAggregates: string[]) => {
    // Clearing the selection falls back to the default aggregate, like the
    // Traces Explore toolbar, so a chart always plots something.
    const aggregates = newAggregates.length
      ? newAggregates
      : [DEFAULT_VISUALIZATION_AGGREGATE];
    updateYAxis({
      yAxes: aggregates.map(aggregate =>
        updateVisualizeAggregate({
          newAggregate: aggregate,
          oldAggregate: parsedFunction?.name,
          oldArguments: parsedFunction?.arguments,
        })
      ),
    });
  };

  const onChangeField = (newField: string) => {
    if (!multiAggregateCharts) {
      updateYAxis({yAxes: [`${parsedFunction!.name}(${newField})`]});
      return;
    }
    // Every aggregate on the chart shares the field.
    updateYAxis({
      yAxes: query.yAxes.map(yAxis => {
        const parsed = parseFunction(yAxis);
        return parsed ? `${parsed.name}(${newField})` : yAxis;
      }),
    });
  };

  const aggregateOptions: Array<SelectOption<string>> = useMemo(() => {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => {
      return {
        label: aggregate,
        value: aggregate,
        textValue: aggregate,
      };
    });
  }, []);

  return (
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
      <Fragment>
        <StyledPageFilterBar>
          {multiAggregateCharts ? (
            <AggregateMultiSelect
              formulas={[]}
              maxAggregates={MAX_VISUALIZES}
              onChange={onChangeAggregates}
              value={selectedAggregates}
            />
          ) : (
            <CompactSelect
              options={aggregateOptions}
              value={parsedFunction?.name ?? ''}
              onChange={newAggregate => {
                const newYAxis = updateVisualizeAggregate({
                  newAggregate: newAggregate.value,
                  oldAggregate: parsedFunction!.name,
                  oldArguments: parsedFunction!.arguments,
                });
                updateYAxis({yAxes: [newYAxis]});
              }}
            />
          )}
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
            onChange={newField => onChangeField(newField.value)}
            disabled={options.length === 1}
          />
        </StyledPageFilterBar>
      </Fragment>
    </Section>
  );
}

function findFirstFunction(
  yAxes: ReadableExploreQueryParts['yAxes']
): ParsedFunction | undefined {
  for (const yAxis of yAxes) {
    const parsed = parseFunction(yAxis);
    if (defined(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

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
