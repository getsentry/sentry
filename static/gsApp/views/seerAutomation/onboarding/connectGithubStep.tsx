import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import connectGithubImg from 'sentry-images/spot/seer-config-connect-1.svg';

import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';

import {ActionSection, MaxWidthPanel, StepContent} from './common';
import {GithubButton} from './githubButton';

export function ConnectGithubStep() {
  const handleAddIntegration = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <Fragment>
      <StepContentWithBackground>
        <MaxWidthPanel>
          <PanelBody withPadding>
            <p>
              {t(
                'In order to get the most out of Sentry and to use Seer, we will need to access your code repositories in GitHub. (We do not currently support Gitlab, Bitbucket, or others) '
              )}
            </p>
            <ActionSection>
              <GithubButton
                onAddIntegration={handleAddIntegration}
                analyticsView="seer_onboarding_github"
              />
            </ActionSection>
            <GuidedSteps.ButtonWrapper>
              <GuidedSteps.NextButton size="md" />
            </GuidedSteps.ButtonWrapper>
          </PanelBody>
        </MaxWidthPanel>
      </StepContentWithBackground>
    </Fragment>
  );
}

const StepContentWithBackground = styled(StepContent)`
  background: url(${connectGithubImg}) no-repeat 638px 0;
  background-size: 228px 160px;
`;
