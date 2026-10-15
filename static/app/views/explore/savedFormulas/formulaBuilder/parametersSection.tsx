import styled from '@emotion/styled';
import {IconDelete} from '@sentry/icons/delete';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {FormulaParamType} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import {BuilderSection} from 'sentry/views/explore/savedFormulas/formulaBuilder/builderSection';
import {
  MAX_PARAMS,
  newParam,
  type DraftParam,
} from 'sentry/views/explore/savedFormulas/formulaBuilder/draft';
import {FormulaEquationInput} from 'sentry/views/explore/savedFormulas/formulaEquationInput';

const SIGMA = '\u03A3';

const VALUE_TYPE_OPTIONS: Array<{label: string; value: FormulaParamType}> = [
  {value: 'number', label: t('number')},
  {value: 'column', label: t('attribute')},
];

export function ParametersSection({
  params,
  onChange,
}: {
  onChange: (params: DraftParam[]) => void;
  params: DraftParam[];
}) {
  // A calculation is derived from the other params, so there has to be one first.
  const valueParams = params.filter(param => param.type !== 'calculation');
  const isFull = params.length >= MAX_PARAMS;

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
      <Stack gap="md">
        {params.map(param => (
          <Flex key={param.key} align="center" gap="md">
            {param.type === 'calculation' ? (
              <CalculationBadge align="center" justify="center" radius="md">
                <Text as="span" bold variant="accent">
                  {SIGMA}
                </Text>
              </CalculationBadge>
            ) : null}
            <NameInput
              value={param.name}
              placeholder={t('Name')}
              aria-label={t('Parameter name')}
              onChange={event => update(param.key, {name: event.target.value})}
            />
            {param.type === 'calculation' ? (
              <Flex flex="1" minWidth="0">
                <FormulaEquationInput
                  value={param.value}
                  names={valueParams.map(valueParam => valueParam.name)}
                  onChange={value => update(param.key, {value})}
                />
              </Flex>
            ) : (
              <Flex flex="1" align="center" gap="md">
                <CompactSelect
                  value={param.type}
                  options={VALUE_TYPE_OPTIONS}
                  trigger={triggerProps => (
                    <OverlayTrigger.Button {...triggerProps} prefix={t('Type')} />
                  )}
                  onChange={option => update(param.key, {type: option.value})}
                />
                <Text variant="muted" size="sm">
                  {t('Set when the formula is used')}
                </Text>
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
        <Flex gap="lg">
          <Tooltip
            title={t('Formulas take at most %s parameters', MAX_PARAMS)}
            disabled={!isFull}
          >
            <Button
              variant="link"
              disabled={isFull}
              onClick={() => onChange([...params, newParam('number')])}
            >
              {t('+ Add parameter')}
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
              variant="link"
              disabled={isFull || valueParams.length === 0}
              onClick={() => onChange([...params, newParam('calculation')])}
            >
              {t('+ Add calculated parameter')}
            </Button>
          </Tooltip>
        </Flex>
      </Stack>
    </BuilderSection>
  );
}

const NameInput = styled(Input)`
  width: 140px;
  flex: none;
`;

const CalculationBadge = styled(Flex)`
  flex: none;
  width: 24px;
  height: 36px;
  background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
`;
