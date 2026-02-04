import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Tooltip} from '@sentry/scraps/tooltip';

import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {parseFunction} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {updateVisualizeAggregate} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
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

type Props = {
  index: number;
  query: ReadableExploreQueryParts;
};

export function VisualizeSection({query, index}: Props) {
  const {tags: stringTags} = useTraceItemTags('string');
  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: booleanTags} = useTraceItemTags('boolean');

  const parsedFunction = findFirstFunction(query.yAxes);

  const options: Array<SelectOption<string>> = useVisualizeFields({
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
          <CompactSelect
            searchable
            options={options}
            value={parsedFunction?.arguments?.[0] ?? ''}
            onChange={newField => {
              const newYAxis = `${parsedFunction!.name}(${newField.value})`;
              updateYAxis({yAxes: [newYAxis]});
            }}
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
