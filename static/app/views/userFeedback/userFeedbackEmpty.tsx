import {useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import emptyStateImg from 'sentry-images/spot/feedback-empty-state.svg';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

type Props = {
  projectIds?: string[];
};

export function UserFeedbackEmpty({projectIds}: Props) {
  const {projects, initiallyLoaded} = useProjects();
  const loadingProjects = !initiallyLoaded;
  const organization = useOrganization();

  const selectedProjects =
    projectIds && projectIds.length
      ? projects.filter(({id}) => projectIds.includes(id))
      : projects;

  const hasAnyFeedback = selectedProjects.some(({hasUserReports}) => hasUserReports);

  useEffect(() => {
    window.sentryEmbedCallback = function (embed) {
      // Mock the embed's submit xhr to always be successful
      // NOTE: this will not have errors if the form is empty
      embed.submit = function (_body) {
        this._submitInProgress = true;
        setTimeout(() => {
          this._submitInProgress = false;
          this.onSuccess();
        }, 500);
      };
    };

    if (hasAnyFeedback === false) {
      // send to reload only due to higher event volume
      trackAnalytics('user_feedback.viewed', {
        organization,
        projects: projectIds?.join(',') || '',
      });
    }
    return () => {
      window.sentryEmbedCallback = null;
    };
  }, [hasAnyFeedback, organization, projectIds]);

  function trackAnalyticsInternal(
    eventKey: 'user_feedback.docs_clicked' | 'user_feedback.dialog_opened'
  ) {
    trackAnalytics(eventKey, {
      organization,
      projects: selectedProjects?.join(','),
    });
  }

  // Show no user reports if waiting for projects to load or if there is no feedback
  if (loadingProjects || hasAnyFeedback !== false) {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no user reports match your filters.')}</p>
      </EmptyStateWarning>
    );
  }

  // Show landing page after projects have loaded and it is confirmed no projects have feedback
  return (
    <OnboardingPanel
      data-test-id="user-feedback-empty"
      image={<img src={emptyStateImg} />}
    >
      <h3>{t('What do users think?')}</h3>
      <p>
        {t(
          `You can't read minds. At least we hope not. Ask users for feedback on the impact of their crashes or bugs and you shall receive.`
        )}
      </p>
      <ButtonList gap={1}>
        <Button
          external
          priority="primary"
          onClick={() => trackAnalyticsInternal('user_feedback.docs_clicked')}
          href="https://docs.sentry.io/product/user-feedback/"
        >
          {t('Read the docs')}
        </Button>
        <Button
          onClick={() => {
            Sentry.showReportDialog({
              // should never make it to the Sentry API, but just in case, use throwaway id
              eventId: '00000000000000000000000000000000',
            });
            trackAnalyticsInternal('user_feedback.dialog_opened');
          }}
        >
          {t('See an example')}
        </Button>
      </ButtonList>
    </OnboardingPanel>
  );
}

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;
