import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';
import * as Sentry from '@sentry/react';

import {Organization, Project} from 'app/types';
import {t} from 'app/locale';
import {trackAnalyticsEvent, trackAdhocEvent} from 'app/utils/analytics';
import Button from 'app/components/button';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import UserFeedbackIllustration from './userFeedbackIllustration';

type Props = {
  organization: Organization;
  projects: Project[];
  loadingProjects: boolean;
  projectIds?: string[];
};

class UserFeedbackEmpty extends React.Component<Props> {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    projectIds: PropTypes.arrayOf(PropTypes.string.isRequired),
  };

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

  get hasAnyFeedback() {
    const {projects, projectIds} = this.props;

    const selectedProjects =
      projectIds && projectIds.length
        ? projects.filter(({id}) => projectIds.includes(id))
        : projects;

    return selectedProjects.some(({hasUserReports}) => hasUserReports);
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
      <UserFeedbackLanding>
        <IllustrationContainer>
          <CardComponentContainer>
            <StyledUserFeedbackIllustration />
          </CardComponentContainer>
        </IllustrationContainer>

        <StyledBox>
          <h3>{t('No User Feedback Collected')}</h3>
          <p>
            {t(
              `Don't rely on stack traces and graphs alone to understand
              the cause and impact of errors. Enable User Feedback to collect
              your users' comments when they encounter a crash or bug.`
            )}
          </p>
          <ButtonList>
            <Button
              external
              onClick={() =>
                this.trackAnalytics({
                  eventKey: 'user_feedback.docs_clicked',
                  eventName: 'User Feedback Docs Clicked',
                })
              }
              href="https://docs.sentry.io/enriching-error-data/user-feedback/"
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
              {t('Open the report dialog')}
            </Button>
          </ButtonList>
        </StyledBox>
      </UserFeedbackLanding>
    );
  }
}

const UserFeedbackLanding = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  min-height: 450px;
  padding: ${space(1)};
`;

const StyledBox = styled('div')`
  flex: 1;
  padding: ${space(3)};
`;

const IllustrationContainer = styled(StyledBox)`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CardComponentContainer = styled('div')`
  display: flex;
  align-items: center;
  width: 550px;
  height: 340px;

  @media (max-width: 1150px) {
    font-size: ${p => p.theme.fontSizeMedium};
    width: 450px;
  }

  @media (max-width: 1000px) {
    font-size: ${p => p.theme.fontSizeSmall};
    width: 320px;
    max-height: 180px;
  }
`;

const StyledUserFeedbackIllustration = styled(UserFeedbackIllustration)`
  width: 100%;
  height: 100%;
`;

const ButtonList = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
  grid-gap: ${space(1)};
`;

export {UserFeedbackEmpty};

export default withOrganization(withProjects(UserFeedbackEmpty));
