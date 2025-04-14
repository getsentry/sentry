import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {parseFunction} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {
  DEFAULT_VISUALIZATION_AGGREGATE,
  DEFAULT_VISUALIZATION_FIELD,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {
  type ReadableExploreQueryParts,
  useUpdateQueryAtIndex,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {
  Section,
  SectionHeader,
  SectionLabel,
} from 'sentry/views/explore/multiQueryMode/queryConstructors/styles';

type Props = {
  index: number;
  query: ReadableExploreQueryParts;
};

export function VisualizeSection({query, index}: Props) {
  const [yAxis, parsedFunction] = findFirstFunction(query.yAxes);

  // We want to lock down the fields dropdown when using count so that we can
  // render `count(spans)` for better legibility. However, for backwards
  // compatibility, we don't want to lock down all `count` queries immediately.
  const lockOptions =
    defined(parsedFunction) &&
    parsedFunction.name === DEFAULT_VISUALIZATION_AGGREGATE &&
    parsedFunction.arguments.length === 1 &&
    parsedFunction.arguments[0] === DEFAULT_VISUALIZATION_FIELD;

  const countFieldOptions: Array<SelectOption<string>> = useMemo(
    () => [
      {
        label: t('spans'),
        value: DEFAULT_VISUALIZATION_FIELD,
        textValue: DEFAULT_VISUALIZATION_FIELD,
      },
    ],
    []
  );
  const defaultFieldOptions: Array<SelectOption<string>> = useVisualizeFields({
    yAxes: query.yAxes,
    yAxis,
  });
  const fieldOptions = lockOptions ? countFieldOptions : defaultFieldOptions;

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
            value={parsedFunction?.name}
            onChange={newAggregate => {
              const newYAxis = updateVisualizeAggregate({
                newAggregate: newAggregate.value,
                oldAggregate: parsedFunction!.name,
                oldArgument: parsedFunction!.arguments[0]!,
              });
              updateYAxis({yAxes: [newYAxis]});
            }}
          />
          <CompactSelect
            searchable
            options={fieldOptions}
            value={parsedFunction?.arguments?.[0]}
            onChange={newField => {
              const newYAxis = `${parsedFunction!.name}(${newField.value})`;
              updateYAxis({yAxes: [newYAxis]});
            }}
            disabled={lockOptions}
          />
        </StyledPageFilterBar>
      </Fragment>
    </Section>
  );
}

function findFirstFunction(
  yAxes: ReadableExploreQueryParts['yAxes']
): [string | undefined, ParsedFunction | undefined] {
  for (const yAxis of yAxes) {
    const parsed = parseFunction(yAxis);
    if (defined(parsed)) {
      return [yAxis, parsed];
    }
  }

  return [undefined, undefined];
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
