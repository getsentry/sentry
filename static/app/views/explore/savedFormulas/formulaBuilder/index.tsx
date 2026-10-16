import {useState} from 'react';
import {IconClose} from '@sentry/icons/close';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {SlideOverPanel} from '@sentry/scraps/slideOverPanel';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {DurationUnit, SizeUnit} from 'sentry/utils/discover/fields';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import type {
  FormulaDataset,
  SavedFormula,
} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import {useSaveFormula} from 'sentry/views/explore/hooks/useSaveFormula';
import {BuilderSection} from 'sentry/views/explore/savedFormulas/formulaBuilder/builderSection';
import {
  toDraft,
  toRequest,
  variableNames,
  type FormulaDraft,
} from 'sentry/views/explore/savedFormulas/formulaBuilder/draft';
import {ParametersSection} from 'sentry/views/explore/savedFormulas/formulaBuilder/parametersSection';
import {ReferencesSection} from 'sentry/views/explore/savedFormulas/formulaBuilder/referencesSection';
import {FormulaEquationInput} from 'sentry/views/explore/savedFormulas/formulaEquationInput';

const DATASET_OPTIONS: Array<{label: string; value: FormulaDataset}> = [
  {value: 'spans', label: t('Spans')},
  {value: 'logs', label: t('Logs')},
  {value: 'metrics', label: t('Metrics')},
];

const NO_UNIT = 'none';

const UNIT_OPTIONS = [
  {value: NO_UNIT, label: t('No unit')},
  ...[...Object.values(DurationUnit), ...Object.values(SizeUnit)].map(unit => ({
    value: unit,
    label: unit,
  })),
];

export function FormulaBuilder({
  formula,
  onClose,
}: {
  onClose: () => void;
  formula?: SavedFormula;
}) {
  const [draft, setDraft] = useState<FormulaDraft>(() => toDraft(formula));
  const {saveFormula, isSaving} = useSaveFormula();

  async function handleSave() {
    try {
      await saveFormula(toRequest(draft));
    } catch (error) {
      const detail = (error as RequestError).responseJSON?.detail;
      addErrorMessage(typeof detail === 'string' ? detail : t('Unable to save formula'));
      return;
    }
    addSuccessMessage(t('Formula saved'));
    onClose();
  }

  return (
    <SlideOverPanel position="right" mode="passive" data-test-id="formula-builder">
      <Flex
        align="center"
        justify="between"
        borderBottom="primary"
        height="44px"
        padding="0 2xl"
      >
        <Heading as="h5" size="md">
          {formula ? t('Edit Formula') : t('Create Formula')}
        </Heading>
        <Button
          variant="transparent"
          size="sm"
          aria-label={t('Close Formula Builder')}
          icon={<IconClose size="sm" />}
          onClick={onClose}
        />
      </Flex>
      <Stack gap="2xl" padding="2xl">
        <BuilderSection
          title={t('Formula Name')}
          description={t('The name this formula is referenced by elsewhere in Sentry.')}
        >
          <Flex gap="md" align="center">
            <Container flexGrow={1}>
              <Input
                value={draft.name}
                placeholder={t('Enter formula name')}
                aria-label={t('Formula name')}
                onChange={event => setDraft({...draft, name: event.target.value})}
              />
            </Container>
            <CompactSelect
              value={draft.dataset}
              options={DATASET_OPTIONS}
              trigger={triggerProps => (
                <OverlayTrigger.Button {...triggerProps} prefix={t('Dataset')} />
              )}
              onChange={option => setDraft({...draft, dataset: option.value})}
            />
            <CompactSelect
              value={draft.unit ?? NO_UNIT}
              options={UNIT_OPTIONS}
              trigger={triggerProps => (
                <OverlayTrigger.Button {...triggerProps} prefix={t('Unit')} />
              )}
              onChange={option =>
                setDraft({...draft, unit: option.value === NO_UNIT ? null : option.value})
              }
            />
          </Flex>
        </BuilderSection>

        <ParametersSection
          params={draft.params}
          onChange={params => setDraft({...draft, params})}
        />

        <ReferencesSection
          dataset={draft.dataset}
          params={draft.params}
          references={draft.references}
          onChange={references => setDraft({...draft, references})}
        />

        <BuilderSection
          title={t('Formula')}
          description={t(
            'Combines the parameters and references into the value the formula returns.'
          )}
        >
          <FormulaEquationInput
            value={draft.formula}
            names={variableNames(draft)}
            onChange={expression => setDraft({...draft, formula: expression})}
          />
        </BuilderSection>

        <Flex gap="md" justify="end">
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button
            variant="primary"
            disabled={!draft.name || !draft.formula}
            busy={isSaving}
            onClick={handleSave}
          >
            {t('Save')}
          </Button>
        </Flex>
      </Stack>
    </SlideOverPanel>
  );
}
