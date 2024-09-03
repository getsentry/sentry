import {useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {parseFunction} from 'sentry/utils/discover/fields';
import type {SpanIndexedField} from 'sentry/views/insights/types';

import {
  ALLOWED_VISUALIZE_AGGREGATES,
  ALLOWED_VISUALIZE_FIELDS,
} from '../hooks/useVisualize';

import {ToolbarHeader, ToolbarHeading, ToolbarSection} from './styles';

interface ToolbarVisualizeProps {
  setVisualize: (visualize: string) => void;
  visualize: string;
}

export function ToolbarVisualize({visualize, setVisualize}: ToolbarVisualizeProps) {
  const parsedVisualize = useMemo(() => {
    return parseFunction(visualize);
  }, [visualize]);

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

  return (
    <ToolbarSection data-test-id="section-visualize">
      <ToolbarHeader>
        <ToolbarHeading>{t('Visualize')}</ToolbarHeading>
      </ToolbarHeader>
      <ToolbarContent>
        <CompactSelect
          size="md"
          options={fieldOptions}
          value={parsedVisualize?.arguments[0]}
          onChange={newField =>
            setVisualize(`${parsedVisualize?.name}(${newField.value})`)
          }
        />
        <CompactSelect
          size="md"
          options={aggregateOptions}
          value={parsedVisualize?.name}
          onChange={newAggregate =>
            setVisualize(`${newAggregate.value}(${parsedVisualize?.arguments[0]})`)
          }
        />
      </ToolbarContent>
    </ToolbarSection>
  );
}

const ToolbarContent = styled('div')`
  display: flex;
`;
