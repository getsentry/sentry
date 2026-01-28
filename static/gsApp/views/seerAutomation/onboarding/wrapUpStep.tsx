import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import nextStepsImg from 'sentry-images/spot/seer-config-bug-2.svg';

import {Button} from '@sentry/scraps/button';
import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {useGuidedStepsContext} from 'sentry/components/guidedSteps/guidedSteps';
import PanelBody from 'sentry/components/panels/panelBody';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import {useSeerOnboardingContext} from './hooks/seerOnboardingContext';
import {ActionSection, MaxWidthPanel, PanelDescription, StepContent} from './common';

export function WrapUpStep() {
  const organization = useOrganization();
  const {selectedCodeReviewRepositories, repositoryProjectMapping, autoCreatePR} =
    useSeerOnboardingContext();
  const {currentStep, setCurrentStep} = useGuidedStepsContext();

  const handlePreviousStep = useCallback(() => {
    setCurrentStep(currentStep - 1);
  }, [setCurrentStep, currentStep]);

  const hasCodeReview = useMemo(
    () => selectedCodeReviewRepositories.length > 0,
    [selectedCodeReviewRepositories]
  );
  const hasRCA = useMemo(
    () => Object.keys(repositoryProjectMapping).length > 0,
    [repositoryProjectMapping]
  );
  const hasAutoCreatePR = useMemo(
    () => (hasRCA && autoCreatePR?.current) ?? false,
    [autoCreatePR, hasRCA]
  );
  const hasCompletedAnySteps = hasCodeReview || hasRCA || hasAutoCreatePR;

  return (
    <Fragment>
      <StepContentWithBackground>
        <MaxWidthPanel>
          <PanelBody>
            {hasCompletedAnySteps ? (
              <PanelDescription>
                <Heading as="h3" size="lg">
                  {t('Congratulations, you’ve finished setting up Seer!')}
                </Heading>
                <Text density="comfortable">
                  {t(
                    'For connected projects and repos, you will now be able to have Seer:'
                  )}
                </Text>
                <NextStepsList>
                  {hasCodeReview && (
                    <li>
                      {t(
                        'Review your PRs and catch bugs before you ship them to production'
                      )}
                    </li>
                  )}
                  {hasRCA && (
                    <li>
                      {t(
                        'Perform root cause analysis on your issues and propose solutions'
                      )}
                    </li>
                  )}
                  {hasAutoCreatePR && <li>{t('Create PRs to fix issues')}</li>}
                </NextStepsList>
                <Text density="comfortable">
                  {tct(
                    'If you want to adjust your configurations, you can modify them on the [settings:Seer Settings Page], or configure [projects:projects] and [repos:repos] individually. ',
                    {
                      settings: <Link to={`/settings/${organization.slug}/seer/`} />,
                      projects: (
                        <Link to={`/settings/${organization.slug}/seer/projects/`} />
                      ),
                      repos: <Link to={`/settings/${organization.slug}/seer/repos/`} />,
                    }
                  )}
                </Text>
              </PanelDescription>
            ) : (
              <PanelDescription>
                <Heading as="h3" size="lg">
                  {t('Seer set-up is not complete')}
                </Heading>
                <Text density="comfortable">
                  {tct(
                    'You can restart the wizard and continue setting up Seer, or if you prefer, you can set-up Seer on the [settings:Seer Settings Page], or configure [projects:projects] and [repos:repos] individually. ',
                    {
                      settings: <Link to={`/settings/${organization.slug}/seer/`} />,
                      projects: (
                        <Link to={`/settings/${organization.slug}/seer/projects/`} />
                      ),
                      repos: <Link to={`/settings/${organization.slug}/seer/repos/`} />,
                    }
                  )}
                </Text>
              </PanelDescription>
            )}
          </PanelBody>
        </MaxWidthPanel>

        <ActionSection>
          <Button size="md" onClick={handlePreviousStep} aria-label={t('Previous Step')}>
            {t('Previous Step')}
          </Button>

          <LinkButton
            priority="primary"
            size="md"
            to={`/settings/${organization.slug}/seer/`}
          >
            {t('Finish')}
          </LinkButton>
        </ActionSection>
      </StepContentWithBackground>
    </Fragment>
  );
}

const StepContentWithBackground = styled(StepContent)`
  background: url(${nextStepsImg}) no-repeat 638px 0;
  background-size: 233px 212px;
  min-height: 220px;
`;

const NextStepsList = styled('ul')`
  margin: ${p => p.theme.space.xl} 0;
`;
