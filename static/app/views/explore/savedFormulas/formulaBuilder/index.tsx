import {useState} from 'react';
import {useTheme} from '@emotion/react';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Container as LayoutContainer, Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {NoAccess} from 'sentry/components/noAccess';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {EditLayout} from 'sentry/components/workflowEngine/layout/edit';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';
import {DurationUnit, SizeUnit} from 'sentry/utils/discover/fields';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  useGetSavedFormula,
  type FormulaDataset,
  type SavedFormula,
} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import {useSaveFormula} from 'sentry/views/explore/hooks/useSaveFormula';
import {FIELD_MAX_WIDTH} from 'sentry/views/explore/savedFormulas/formulaBuilder/builderSection';
import {
  stripNamePrefix,
  toDraft,
  toRequest,
  variableNames,
  type FormulaDraft,
} from 'sentry/views/explore/savedFormulas/formulaBuilder/draft';
import {OptionSizedLabel} from 'sentry/views/explore/savedFormulas/formulaBuilder/optionSizedLabel';
import {ParametersSection} from 'sentry/views/explore/savedFormulas/formulaBuilder/parametersSection';
import {ReferencesSection} from 'sentry/views/explore/savedFormulas/formulaBuilder/referencesSection';
import {FormulaEquationInput} from 'sentry/views/explore/savedFormulas/formulaEquationInput';
import {makeSavedFormulasPathname} from 'sentry/views/explore/savedFormulas/pathnames';
import {TopBar} from 'sentry/views/navigation/topBar';

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

export default function FormulaBuilderPage() {
  const organization = useOrganization();
  const {formulaId} = useParams<{formulaId?: string}>();

  return (
    <SentryDocumentTitle
      title={formulaId ? t('Edit Formula') : t('Create Formula')}
      orgSlug={organization.slug}
    >
      <Feature
        features="organizations:explore-saved-formulas"
        organization={organization}
        renderDisabled={NoAccess}
      >
        <ErrorBoundary>
          {formulaId ? <EditFormula formulaId={formulaId} /> : <FormulaBuilder />}
        </ErrorBoundary>
      </Feature>
    </SentryDocumentTitle>
  );
}

function EditFormula({formulaId}: {formulaId: string}) {
  const {
    data: formula,
    isPending,
    isError,
    isFetchedAfterMount,
    refetch,
  } = useGetSavedFormula(formulaId);

  if (isError) {
    return (
      <Layout.Body>
        <Layout.Main width="full">
          <LoadingError message={t('Unable to load formula')} onRetry={refetch} />
        </Layout.Main>
      </Layout.Body>
    );
  }

  // The draft is only seeded on mount, so wait for a fresh fetch rather than
  // starting from a cached copy that may predate the last save.
  if (isPending || !isFetchedAfterMount) {
    return <LoadingIndicator />;
  }

  return <FormulaBuilder formula={formula} />;
}

function FormulaBuilder({formula}: {formula?: SavedFormula}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const theme = useTheme();
  const maxWidth = theme.breakpoints.xl;
  const [draft, setDraft] = useState<FormulaDraft>(() => toDraft(formula));
  const {saveFormula, isSaving} = useSaveFormula();
  const isPrebuilt = formula?.prebuilt ?? false;

  const listPathname = makeSavedFormulasPathname({organization, path: '/'});

  async function handleSave() {
    try {
      await saveFormula(toRequest(draft));
    } catch (error) {
      const detail = (error as RequestError).responseJSON?.detail;
      addErrorMessage(typeof detail === 'string' ? detail : t('Unable to save formula'));
      return;
    }
    addSuccessMessage(t('Formula saved'));
    navigate(listPathname);
  }

  return (
    <EditLayout>
      <TopBar.Slot
        name="breadcrumbs"
        title={{
          type: 'page-title',
          label: formula ? stripNamePrefix(formula.name) : t('New Formula'),
        }}
        items={[{type: 'link', label: t('Saved Formulas'), to: listPathname}]}
      />

      <EditLayout.Body>
        <Stack gap="2xl" maxWidth={maxWidth}>
          {isPrebuilt && (
            <Alert.Container>
              <Alert variant="warning" showIcon={false}>
                {t('Formulas built by Sentry cannot be edited.')}
              </Alert>
            </Alert.Container>
          )}
          <Flex gap="xl" wrap="wrap">
            <LabeledField label={t('Formula Name')}>
              <LayoutContainer width="320px">
                <Input
                  value={draft.name}
                  placeholder={t('Enter formula name')}
                  aria-label={t('Formula name')}
                  disabled={isPrebuilt}
                  onChange={event => setDraft({...draft, name: event.target.value})}
                />
              </LayoutContainer>
            </LabeledField>
            <LabeledField label={t('Dataset')}>
              <CompactSelect
                value={draft.dataset}
                options={DATASET_OPTIONS}
                disabled={isPrebuilt}
                trigger={({children, ...triggerProps}) => (
                  <OverlayTrigger.Button {...triggerProps} aria-label={t('Dataset')}>
                    <OptionSizedLabel options={DATASET_OPTIONS}>
                      {children}
                    </OptionSizedLabel>
                  </OverlayTrigger.Button>
                )}
                onChange={option => setDraft({...draft, dataset: option.value})}
              />
            </LabeledField>
            <LabeledField label={t('Unit')}>
              <CompactSelect
                value={draft.unit ?? NO_UNIT}
                options={UNIT_OPTIONS}
                disabled={isPrebuilt}
                trigger={({children, ...triggerProps}) => (
                  <OverlayTrigger.Button {...triggerProps} aria-label={t('Unit')}>
                    <OptionSizedLabel options={UNIT_OPTIONS}>{children}</OptionSizedLabel>
                  </OverlayTrigger.Button>
                )}
                onChange={option =>
                  setDraft({
                    ...draft,
                    unit: option.value === NO_UNIT ? null : option.value,
                  })
                }
              />
            </LabeledField>
          </Flex>

          <Container>
            <FormSection title={t('Inputs')}>
              <Stack gap="2xl">
                <ParametersSection
                  params={draft.params}
                  disabled={isPrebuilt}
                  onChange={params => setDraft({...draft, params})}
                />
                <ReferencesSection
                  dataset={draft.dataset}
                  params={draft.params}
                  references={draft.references}
                  disabled={isPrebuilt}
                  onChange={references => setDraft({...draft, references})}
                />
              </Stack>
            </FormSection>
          </Container>

          <Container>
            <FormSection
              title={t('Formula')}
              description={t(
                'Combines the parameters and references into the value the formula returns.'
              )}
            >
              <LayoutContainer maxWidth={FIELD_MAX_WIDTH}>
                <FormulaEquationInput
                  value={draft.formula}
                  names={variableNames(draft)}
                  disabled={isPrebuilt}
                  onChange={expression => setDraft({...draft, formula: expression})}
                />
              </LayoutContainer>
            </FormSection>
          </Container>
        </Stack>
      </EditLayout.Body>

      <EditLayout.Footer maxWidth={maxWidth}>
        <LinkButton size="sm" to={listPathname}>
          {t('Cancel')}
        </LinkButton>
        <Button
          size="sm"
          variant="primary"
          disabled={isPrebuilt || !draft.name || !draft.formula}
          busy={isSaving}
          onClick={handleSave}
        >
          {t('Save')}
        </Button>
      </EditLayout.Footer>
    </EditLayout>
  );
}

function LabeledField({label, children}: {children: React.ReactNode; label: string}) {
  return (
    <Stack gap="md">
      <Text bold>{label}</Text>
      {children}
    </Stack>
  );
}
