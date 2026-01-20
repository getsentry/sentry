import {useCallback, useContext, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Input} from 'sentry/components/core/input';
import {Flex} from 'sentry/components/core/layout';
import FormContext from 'sentry/components/forms/formContext';
import {IconAdd, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PreprodFilter} from 'sentry/types/workflowEngine/detectors';
import {
  PREPROD_DETECTOR_FORM_FIELDS,
  usePreprodDetectorFormField,
} from 'sentry/views/detectors/components/forms/mobileBuild/mobileBuildFormData';

const FILTER_KEY_OPTIONS = [
  {value: 'build.platform' as const, label: t('build.platform')},
  {value: 'build.package' as const, label: t('build.package')},
  {value: 'build.build_configuration' as const, label: t('build.build_configuration')},
  {value: 'build.branch' as const, label: t('build.branch')},
];

export function MobileBuildFilterBuilder() {
  const formContext = useContext(FormContext);
  const rawFilters = usePreprodDetectorFormField(PREPROD_DETECTOR_FORM_FIELDS.filters);
  const filters = useMemo(() => rawFilters || [], [rawFilters]);

  const addFilter = useCallback(() => {
    const newFilters: PreprodFilter[] = [...filters, {key: 'build.platform', value: ''}];
    formContext.form?.setValue(
      PREPROD_DETECTOR_FORM_FIELDS.filters,
      newFilters as unknown as Record<string, unknown>
    );
  }, [filters, formContext.form]);

  const removeFilter = useCallback(
    (index: number) => {
      const newFilters = filters.filter((_, i) => i !== index);
      formContext.form?.setValue(
        PREPROD_DETECTOR_FORM_FIELDS.filters,
        newFilters as unknown as Record<string, unknown>
      );
    },
    [filters, formContext.form]
  );

  const updateFilter = useCallback(
    (index: number, updates: Partial<PreprodFilter>) => {
      const newFilters = filters.map((filter, i) =>
        i === index ? {...filter, ...updates} : filter
      );
      formContext.form?.setValue(
        PREPROD_DETECTOR_FORM_FIELDS.filters,
        newFilters as unknown as Record<string, unknown>
      );
    },
    [filters, formContext.form]
  );

  return (
    <Flex direction="column" gap="sm">
      {filters.length > 0 && (
        <FiltersContainer>
          {filters.map((filter, index) => (
            <FilterRow
              key={index}
              filter={filter}
              onUpdate={updates => updateFilter(index, updates)}
              onRemove={() => removeFilter(index)}
            />
          ))}
        </FiltersContainer>
      )}
      <div>
        <Button size="sm" icon={<IconAdd />} onClick={addFilter}>
          {t('Add Filter')}
        </Button>
      </div>
    </Flex>
  );
}

interface FilterRowProps {
  filter: PreprodFilter;
  onRemove: () => void;
  onUpdate: (updates: Partial<PreprodFilter>) => void;
}

function FilterRow({filter, onUpdate, onRemove}: FilterRowProps) {
  return (
    <FilterRowContainer>
      <CompactSelect
        value={filter.key}
        options={FILTER_KEY_OPTIONS}
        onChange={option => {
          onUpdate({key: option.value});
        }}
        size="xs"
        triggerProps={{
          'aria-label': t('Filter key'),
        }}
      />
      <FilterOperator>{t('is')}</FilterOperator>
      <FilterValueInput
        value={filter.value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onUpdate({value: e.target.value})
        }
        placeholder={t('Enter value')}
        size="xs"
        aria-label={t('Filter value')}
      />
      <RemoveButton
        icon={<IconClose size="xs" />}
        onClick={onRemove}
        aria-label={t('Remove filter')}
        size="xs"
        borderless
      />
    </FilterRowContainer>
  );
}

const FiltersContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
  padding: ${space(1.5)};
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;

const FilterRowContainer = styled('div')`
  display: inline-flex;
  align-items: center;
  gap: ${space(0.5)};
  padding: ${space(0.5)} ${space(1)};
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.sm};
`;

const FilterOperator = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.sm};
`;

const FilterValueInput = styled(Input)`
  width: 150px;
`;

const RemoveButton = styled(Button)`
  color: ${p => p.theme.tokens.content.secondary};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;
