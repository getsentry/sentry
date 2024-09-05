import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {parseFunction} from 'sentry/utils/discover/fields';
import {
  ALLOWED_VISUALIZE_AGGREGATES,
  ALLOWED_VISUALIZE_FIELDS,
  DEFAULT_VISUALIZATION,
  useVisualizes,
} from 'sentry/views/explore/hooks/useVisualizes';
import type {SpanIndexedField} from 'sentry/views/insights/types';

import {
  ToolbarHeader,
  ToolbarHeaderButton,
  ToolbarHeading,
  ToolbarSection,
} from './styles';

interface ToolbarVisualizeProps {}

export function ToolbarVisualize({}: ToolbarVisualizeProps) {
  const [visualizes, setVisualizes] = useVisualizes();

  const parsedVisualizes: ParsedFunction[] = useMemo(() => {
    return visualizes.map(parseFunction).filter(defined);
  }, [visualizes]);

  const fieldOptions: SelectOption<SpanIndexedField>[] = ALLOWED_VISUALIZE_FIELDS.map(
    field => {
      return {
        label: field,
        value: field,
      };
    }
  );

  const aggregateOptions: SelectOption<string>[] = ALLOWED_VISUALIZE_AGGREGATES.map(
    aggregate => {
      return {
        label: aggregate,
        value: aggregate,
      };
    }
  );

  const addChart = useCallback(() => {
    setVisualizes([...visualizes, DEFAULT_VISUALIZATION]);
  }, [setVisualizes, visualizes]);

  const setChartField = useCallback(
    (index: number, {value}: SelectOption<string>) => {
      const newVisualizes = [...visualizes];
      newVisualizes[index] = `${parsedVisualizes[index].name}(${value})`;
      setVisualizes(newVisualizes);
    },
    [parsedVisualizes, setVisualizes, visualizes]
  );

  const setChartAggregate = useCallback(
    (index: number, {value}: SelectOption<string>) => {
      const newVisualizes = [...visualizes];
      newVisualizes[index] = `${value}(${parsedVisualizes[index].arguments[0]})`;
      setVisualizes(newVisualizes);
    },
    [parsedVisualizes, setVisualizes, visualizes]
  );

  return (
    <ToolbarSection data-test-id="section-visualizes">
      <ToolbarHeader>
        <ToolbarHeading>{t('Visualize')}</ToolbarHeading>
        <ToolbarHeaderButton size="xs" onClick={addChart} borderless>
          {t('+Add Chart')}
        </ToolbarHeaderButton>
      </ToolbarHeader>
      {parsedVisualizes.map((parsedVisualize, index) => (
        <VisualizeOption key={index}>
          <CompactSelect
            size="md"
            options={fieldOptions}
            value={parsedVisualize.arguments[0]}
            onChange={newField => setChartField(index, newField)}
          />
          <CompactSelect
            size="md"
            options={aggregateOptions}
            value={parsedVisualize?.name}
            onChange={newAggregate => setChartAggregate(index, newAggregate)}
          />
        </VisualizeOption>
      ))}
    </ToolbarSection>
  );
}

const VisualizeOption = styled('div')`
  display: flex;
`;
