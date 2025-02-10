import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
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
  const parsedFunction = query.yAxes.map(parseFunction).filter(defined)[0];

  const fieldOptions: Array<SelectOption<string>> = useVisualizeFields({
    yAxes: query.yAxes,
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
          position="right"
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
              const newYAxis = `${newAggregate.value}(${parsedFunction!.arguments[0]})`;
              updateYAxis({yAxes: [newYAxis]});
            }}
          />
          <CompactSelect
            searchable
            options={fieldOptions}
            value={parsedFunction?.arguments[0]}
            onChange={newField => {
              const newYAxis = `${parsedFunction!.name}(${newField.value})`;
              updateYAxis({yAxes: [newYAxis]});
            }}
          />
        </StyledPageFilterBar>
      </Fragment>
    </Section>
  );
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
