import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import defaultsImg from 'sentry-images/spot/seer-config-error.svg';

import {Button} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Flex} from 'sentry/components/core/layout/flex';
import {Link} from 'sentry/components/core/link';
import {Switch} from 'sentry/components/core/switch';
import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelBody from 'sentry/components/panels/panelBody';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useUpdateOrganization} from 'sentry/utils/useUpdateOrganization';

import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

import {
  Field,
  FieldDescription,
  FieldLabel,
  MaxWidthPanel,
  PanelDescription,
  StepContent,
} from './common';

export function ConfigureDefaultsStep() {
  const organization = useOrganization();
  const [proposeFixesEnabled, setProposeFixesEnabled] = useState(
    organization.defaultAutofixAutomationTuning !== 'off'
  );
  const [autoCreatePREnabled, setAutoCreatePREnabled] = useState(
    organization.autoOpenPrs ?? false
  );
  const [enableCodeReview, setEnableCodeReview] = useState(
    organization.autoEnableCodeReview ?? true
  );

  const {currentStep, setCurrentStep} = useGuidedStepsContext();

  const {mutate: updateOrganization, isPending: isUpdateOrganizationPending} =
    useUpdateOrganization(organization);

  const handlePreviousStep = useCallback(() => {
    setCurrentStep(currentStep - 1);
  }, [setCurrentStep, currentStep]);

  const handleNextStep = useCallback(() => {
    updateOrganization(
      {
        defaultAutofixAutomationTuning: proposeFixesEnabled ? 'medium' : 'off',
        autoOpenPrs: autoCreatePREnabled,
        autoEnableCodeReview: enableCodeReview,
      },
      {
        onSuccess: () => {
          trackGetsentryAnalytics('seer.onboarding.defaults_updated', {
            organization,
            enable_code_review: enableCodeReview,
            enable_root_cause_analysis: proposeFixesEnabled,
            auto_create_pr: autoCreatePREnabled,
          });

          addSuccessMessage(t('Seer default settings updated successfully'));
          setCurrentStep(currentStep + 1);
        },
        onError: () => {
          addErrorMessage(
            t('Failed to update Seer default settings, reload and try again')
          );
        },
      }
    );
  }, [
    autoCreatePREnabled,
    enableCodeReview,
    proposeFixesEnabled,
    updateOrganization,
    currentStep,
    setCurrentStep,
    organization,
  ]);

  return (
    <Fragment>
      <StepContentWithBackground>
        <MaxWidthPanel>
          <PanelBody>
            <PanelDescription>
              <p>
                {tct(
                  `Create default settings for all future projects and repositories. If you don’t turn this defaults on now, you can always manage them from the [link:Seer Settings Page].`,
                  {
                    link: <Link to={`/settings/${organization.slug}/seer/`} />,
                  }
                )}
              </p>
              <p>
                {t(
                  `This will not effect the configuration of the repos and projects on the previous two steps.`
                )}
              </p>
            </PanelDescription>

            <Field>
              <Flex direction="column" flex="1" gap="xs">
                <FieldLabel>{t('Enable AI Code Review')}</FieldLabel>
                <FieldDescription>
                  {t(
                    'For all NEW projects, Seer will review your PRs and flag potential bugs.'
                  )}
                </FieldDescription>
              </Flex>
              <Switch
                size="lg"
                checked={enableCodeReview}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEnableCodeReview(e.target.checked)
                }
              />
            </Field>
            <Field>
              <Flex direction="column" flex="1" gap="xs">
                <FieldLabel>{t('Enable Root Cause Analysis')}</FieldLabel>
                <FieldDescription>
                  <Text>
                    {t(
                      'For all NEW projects, Seer will automatically analyze highly actionable issues, create a root cause analysis, and propose a solution. '
                    )}
                  </Text>
                </FieldDescription>
              </Flex>
              <Switch
                size="lg"
                checked={proposeFixesEnabled}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setProposeFixesEnabled(e.target.checked)
                }
              />
            </Field>
            <Field>
              <Flex direction="column" flex="1" gap="xs">
                <FieldLabel>{t('Automatic PR Creation')}</FieldLabel>
                <FieldDescription>
                  {t('For all NEW projects, Seer will be able to create a pull request.')}
                </FieldDescription>
              </Flex>
              <Switch
                size="lg"
                checked={autoCreatePREnabled}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setAutoCreatePREnabled(e.target.checked)
                }
              />
            </Field>
          </PanelBody>
        </MaxWidthPanel>
      </StepContentWithBackground>

      <GuidedSteps.ButtonWrapper>
        <Button size="md" onClick={handlePreviousStep} aria-label={t('Previous Step')}>
          {t('Previous Step')}
        </Button>
        <Button
          size="md"
          onClick={handleNextStep}
          priority="primary"
          disabled={isUpdateOrganizationPending}
          aria-label={t('Last Step')}
        >
          {t('Last Step')}
        </Button>
        {isUpdateOrganizationPending && <InlineLoadingIndicator size={20} />}
      </GuidedSteps.ButtonWrapper>
    </Fragment>
  );
}

const StepContentWithBackground = styled(StepContent)`
  background: url(${defaultsImg}) no-repeat 638px 0;
  background-size: 192px 168px;
`;

const InlineLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;
