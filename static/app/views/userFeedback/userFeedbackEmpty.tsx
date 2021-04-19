import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import emptyStateImg from 'sentry-images/spot/feedback-empty-state.svg';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import OnboardingPanel from 'app/components/onboardingPanel';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {trackAdhocEvent, trackAnalyticsEvent} from 'app/utils/analytics';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

type Props = {
  organization: Organization;
  projects: Project[];
  loadingProjects: boolean;
  projectIds?: string[];
};

class UserFeedbackEmpty extends React.Component<Props> {
  componentDidMount() {
    const {organization, projectIds} = this.props;

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

    if (this.hasAnyFeedback === false) {
      // send to reload only due to higher event volume
      trackAdhocEvent({
        eventKey: 'user_feedback.viewed',
        org_id: parseInt(organization.id, 10),
        projects: projectIds,
      });
    }
  }

  componentWillUnmount() {
    window.sentryEmbedCallback = null;
  }

  get selectedProjects() {
    const {projects, projectIds} = this.props;

    return projectIds && projectIds.length
      ? projects.filter(({id}) => projectIds.includes(id))
      : projects;
  }

  get hasAnyFeedback() {
    return this.selectedProjects.some(({hasUserReports}) => hasUserReports);
  }

  trackAnalytics({eventKey, eventName}: {eventKey: string; eventName: string}) {
    const {organization, projectIds} = this.props;

    trackAnalyticsEvent({
      eventKey,
      eventName,
      organization_id: organization.id,
      projects: projectIds,
    });
  }

  render() {
    // Show no user reports if waiting for projects to load or if there is no feedback
    if (this.props.loadingProjects || this.hasAnyFeedback !== false) {
      return (
        <EmptyStateWarning>
          <p>{t('Sorry, no user reports match your filters.')}</p>
        </EmptyStateWarning>
      );
    }
    // Show landing page after projects have loaded and it is confirmed no projects have feedback
    return (
      <OnboardingPanel image={<img src={emptyStateImg} />}>
        <h3>{t('What do users think?')}</h3>
        <p>
          {t(
            `You can't read minds. At least we hope not. Ask users for feedback on the impact of their crashes or bugs and you shall receive.`
          )}
        </p>
        <ButtonList gap={1}>
          <Button
            external
            onClick={() =>
              this.trackAnalytics({
                eventKey: 'user_feedback.docs_clicked',
                eventName: 'User Feedback Docs Clicked',
              })
            }
            href={`https://docs.sentry.io/platforms/${
              this.selectedProjects[0]?.platform || 'javascript'
            }/enriching-events/user-feedback/`}
          >
            {t('Read the docs')}
          </Button>
          <Button
            priority="primary"
            onClick={() => {
              Sentry.showReportDialog({
                // should never make it to the Sentry API, but just in case, use throwaway id
                eventId: '00000000000000000000000000000000',
              });

              this.trackAnalytics({
                eventKey: 'user_feedback.dialog_opened',
                eventName: 'User Feedback Dialog Opened',
              });
            }}
          >
            {t('Open Dialog')}
          </Button>
        </ButtonList>
      </OnboardingPanel>
    );
  }
}

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

export {UserFeedbackEmpty};

export default withOrganization(withProjects(UserFeedbackEmpty));
