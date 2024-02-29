import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import feedbackOnboardingImg from 'sentry-images/spot/feedback-onboarding.svg';

import {Button, LinkButton} from 'sentry/components/button';
import {useFeedbackOnboardingSidebarPanel} from 'sentry/components/feedback/useFeedbackOnboarding';
import {FeedbackOnboardingWebApiBanner} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import Panel from 'sentry/components/panels/panel';
import {feedbackWebApiPlatforms} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

export default function FeedbackSetupPanel() {
  const organization = useOrganization();
  const hasNewOnboarding = organization.features.includes('user-feedback-onboarding');
  const {activateSidebar} = useFeedbackOnboardingSidebarPanel();

  const pageFilters = usePageFilters();
  const projects = useProjects();

  const selectedProjects = projects.projects.filter(p =>
    pageFilters.selection.projects.includes(Number(p.id))
  );

  const hasSelectedProjects = selectedProjects.length > 0;

  const allSelectedProjectsUnsupported = selectedProjects.every(p =>
    feedbackWebApiPlatforms.includes(p.platform!)
  );

  useEffect(() => {
    trackAnalytics('feedback.index-setup-viewed', {
      organization,
    });
  }, [organization]);

  const webApiPlatform = hasSelectedProjects && allSelectedProjectsUnsupported;

  return (
    <Fragment>
      {webApiPlatform && <FeedbackOnboardingWebApiBanner />}
      <NoMarginPanel>
        <Container>
          <IlloBox>
            <img src={feedbackOnboardingImg} />
          </IlloBox>
          <StyledBox>
            <Fragment>
              <h3>{t('Introducing the New User Feedback')}</h3>
              <p>
                {t(
                  'Allow your users to create bug reports so they can let you know about these sneaky issues right away. Every report will automatically include related replays, tags, and errors, making fixing the issue dead simple.'
                )}
              </p>
              {hasNewOnboarding ? (
                webApiPlatform ? (
                  <LinkButton
                    external
                    href="https://docs.sentry.io/api/projects/submit-user-feedback/"
                    priority="primary"
                  >
                    {t('Set Up Now')}
                  </LinkButton>
                ) : (
                  <Button external onClick={activateSidebar} priority="primary">
                    {t('Set Up Now')}
                  </Button>
                )
              ) : (
                <LinkButton
                  external
                  href="https://docs.sentry.io/product/user-feedback/setup/"
                  priority="primary"
                  analyticsEventName="Clicked Feedback Onboarding Setup Button"
                  analyticsEventKey="feedback.index-setup-button-clicked"
                  analyticsParams={{surface: 'setup-panel'}}
                >
                  {t('Set Up Now')}
                </LinkButton>
              )}
            </Fragment>
          </StyledBox>
        </Container>
      </NoMarginPanel>
    </Fragment>
  );
}

const NoMarginPanel = styled(Panel)`
  max-height: 100%;
  overflow: scroll;
  margin: 0;
`;

const Container = styled('div')`
  padding: ${space(3)};
  position: relative;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
    min-height: 300px;
    max-width: 1000px;
    margin: 0 auto;
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    min-height: 350px;
  }
`;

const StyledBox = styled('div')`
  min-width: 0;
  z-index: 1;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex: 2;
  }
`;

const IlloBox = styled(StyledBox)`
  position: relative;
  min-height: 100px;
  max-width: 300px;
  min-width: 150px;
  margin: ${space(2)} auto;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex: 1;
    margin: ${space(3)};
    max-width: auto;
  }
`;
