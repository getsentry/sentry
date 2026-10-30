import {useMemo} from 'react';
import styled from '@emotion/styled';
import {IconAdd} from '@sentry/icons/add';
import {IconDelete} from '@sentry/icons/delete';

import {Button} from '@sentry/scraps/button';
import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {optionFromTag} from 'sentry/views/explore/components/attributeOption';
import type {
  FormulaDataset,
  FormulaParamType,
} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import {useTraceItemDatasetAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {
  BuilderSection,
  FIELD_MAX_WIDTH,
} from 'sentry/views/explore/savedFormulas/formulaBuilder/builderSection';
import {
  isInvalidSuggestedNumber,
  MAX_INPUT_PARAMS,
  MAX_PARAMS,
  newParam,
  type DraftParam,
} from 'sentry/views/explore/savedFormulas/formulaBuilder/draft';
import {OptionSizedLabel} from 'sentry/views/explore/savedFormulas/formulaBuilder/optionSizedLabel';
import {TRACE_ITEM_DATASET_MAP} from 'sentry/views/explore/savedFormulas/formulaBuilder/referencesSection';
import {FormulaEquationInput} from 'sentry/views/explore/savedFormulas/formulaEquationInput';

const SIGMA = '\u03A3';

const VALUE_TYPE_OPTIONS: Array<{label: string; value: FormulaParamType}> = [
  {value: 'number', label: t('number')},
  {value: 'column', label: t('attribute')},
];

function useColumnOptions(dataset: FormulaDataset) {
  const traceItemType = TRACE_ITEM_DATASET_MAP[dataset];
  const {attributes, isLoading} = useTraceItemDatasetAttributes(
    traceItemType,
    {},
    'number'
  );
  const options = useMemo(
    () => Object.values(attributes).map(tag => optionFromTag(tag, traceItemType)),
    [attributes, traceItemType]
  );
  return {options, isLoading};
}

function withSavedColumn(options: Array<SelectOption<string>>, value: string) {
  if (!value || options.some(option => option.value === value)) {
    return options;
  }
  return [{value, label: value, textValue: value}, ...options];
}

export function ParametersSection({
  dataset,
  params,
  onChange,
}: {
  dataset: FormulaDataset;
  onChange: (params: DraftParam[]) => void;
  params: DraftParam[];
}) {
  const {options: columnOptions, isLoading: isColumnsLoading} = useColumnOptions(dataset);
  // A calculation is derived from the other params, so there has to be one first.
  const valueParams = params.filter(param => param.type !== 'calculation');
  const isFull = params.length >= MAX_PARAMS;
  const isInputFull = valueParams.length >= MAX_INPUT_PARAMS;

  function update(key: string, changes: Partial<DraftParam>) {
    onChange(params.map(param => (param.key === key ? {...param, ...changes} : param)));
  }

  return (
    <BuilderSection
      title={t('Parameters')}
      description={t(
        'Values the formula accepts when it is used, the same way a function takes arguments.'
      )}
    >
      <Stack gap="lg">
        {params.map(param => (
          <Flex key={param.key} align="center" gap="md" maxWidth={FIELD_MAX_WIDTH}>
            <NameInput
              value={param.name}
              placeholder={t('Name')}
              aria-label={t('Parameter name')}
              onChange={event => update(param.key, {name: event.target.value})}
            />
            {param.type === 'calculation' ? (
              <Container position="relative" flex="1" minWidth="0">
                <CalculationEquationInput
                  value={param.value}
                  names={valueParams.map(valueParam => valueParam.name)}
                  onChange={value => update(param.key, {value})}
                />
                <CalculationTab align="center" justify="center">
                  <Text as="span" bold variant="accent">
                    {SIGMA}
                  </Text>
                </CalculationTab>
              </Container>
            ) : (
              <Flex flex="1" align="center" gap="md" minWidth="0">
                <CompactSelect
                  value={param.type}
                  options={VALUE_TYPE_OPTIONS}
                  trigger={({children, ...triggerProps}) => (
                    <OverlayTrigger.Button {...triggerProps} prefix={t('Type')}>
                      <OptionSizedLabel options={VALUE_TYPE_OPTIONS}>
                        {children}
                      </OptionSizedLabel>
                    </OverlayTrigger.Button>
                  )}
                  onChange={option => {
                    if (option.value !== param.type) {
                      update(param.key, {type: option.value, value: ''});
                    }
                  }}
                />
                {param.type === 'number' ? (
                  <Container flex="1" minWidth="0">
                    <Input
                      value={param.value}
                      inputMode="decimal"
                      placeholder={t('Suggested value')}
                      aria-label={t('Suggested value')}
                      aria-invalid={isInvalidSuggestedNumber(param)}
                      onChange={event => update(param.key, {value: event.target.value})}
                    />
                  </Container>
                ) : (
                  <SuggestedColumnSelect
                    search
                    clearable
                    value={param.value || undefined}
                    options={withSavedColumn(columnOptions, param.value)}
                    loading={isColumnsLoading}
                    trigger={({children, ...triggerProps}) => (
                      <OverlayTrigger.Button
                        {...triggerProps}
                        style={{width: '100%'}}
                        aria-label={t('Suggested value')}
                      >
                        {param.value ? children : t('Suggested value')}
                      </OverlayTrigger.Button>
                    )}
                    onChange={option =>
                      update(param.key, {
                        value: typeof option?.value === 'string' ? option.value : '',
                      })
                    }
                  />
                )}
              </Flex>
            )}
            <Button
              variant="transparent"
              size="sm"
              icon={<IconDelete size="sm" />}
              aria-label={t('Remove parameter')}
              onClick={() => onChange(params.filter(other => other.key !== param.key))}
            />
          </Flex>
        ))}
        <Flex gap="md">
          <Tooltip
            title={
              isFull
                ? t('Formulas take at most %s parameters', MAX_PARAMS)
                : t(
                    'Formulas take at most %s non-calculated parameters',
                    MAX_INPUT_PARAMS
                  )
            }
            disabled={!isFull && !isInputFull}
          >
            <Button
              size="sm"
              icon={<IconAdd />}
              disabled={isFull || isInputFull}
              onClick={() => onChange([...params, newParam('number')])}
            >
              {t('Add Parameter')}
            </Button>
          </Tooltip>
          <Tooltip
            title={
              isFull
                ? t('Formulas take at most %s parameters', MAX_PARAMS)
                : t('Add a parameter to calculate from first')
            }
            disabled={!isFull && valueParams.length > 0}
          >
            <Button
              size="sm"
              icon={<IconAdd />}
              disabled={isFull || valueParams.length === 0}
              onClick={() => onChange([...params, newParam('calculation')])}
            >
              {t('Add Calculated Parameter')}
            </Button>
          </Tooltip>
        </Flex>
      </Stack>
    </BuilderSection>
  );
}

const NameInput = styled(Input)`
  width: 200px;
  flex: none;
`;

const SuggestedColumnSelect = styled(CompactSelect)`
  flex: 1;
  min-width: 0;
`;

const TAB_WIDTH = 28;

const CalculationEquationInput = styled(FormulaEquationInput)`
  padding-left: ${TAB_WIDTH}px;
`;

const CalculationTab = styled(Flex)`
  position: absolute;
  top: 1px;
  bottom: 1px;
  left: 1px;
  width: ${TAB_WIDTH}px;
  pointer-events: none;
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => `${p.theme.form.md.borderRadius} 0 0 ${p.theme.form.md.borderRadius}`};
  background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
`;
