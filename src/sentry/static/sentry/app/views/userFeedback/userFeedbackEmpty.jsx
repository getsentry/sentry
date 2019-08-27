import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';
import * as Sentry from '@sentry/browser';

import {t} from 'app/locale';
import {trackAnalyticsEvent, trackAdhocEvent} from 'app/utils/analytics';
import Button from 'app/components/button';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

class UserFeedbackEmpty extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    projectIds: PropTypes.arrayOf(PropTypes.string.isRequired),
  };

  componentDidMount() {
    const {organization, projectIds} = this.props;

    window.sentryEmbedCallback = function(embed) {
      // Mock the embed's submit xhr to always be successful
      // NOTE: this will not have errors if the form is empty
      embed.submit = function(_body) {
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
    const {
      organization: {projects},
      projectIds,
    } = this.props;

    const selectedProjects =
      projectIds && projectIds.length
        ? projects.filter(({id}) => projectIds.includes(id))
        : projects;

    return selectedProjects.some(
      ({hasAccess, hasUserReports}) => hasAccess && !!hasUserReports
    );
  }

  trackAnalytics({eventKey, eventName}) {
    const {organization, projectIds} = this.props;

    trackAnalyticsEvent({
      eventKey,
      eventName,
      organization_id: organization.id,
      projects: projectIds,
    });
  }

  render() {
    if (this.hasAnyFeedback === true) {
      return (
        <EmptyStateWarning>
          <p>{t('Sorry, no user reports match your filters.')}</p>
        </EmptyStateWarning>
      );
    }

    return (
      <UserFeedbackLanding>
        <StyledContainer>{/* dreamy component place holder */}</StyledContainer>

        <StyledContainer>
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
        </StyledContainer>
      </UserFeedbackLanding>
    );
  }
}

const UserFeedbackLanding = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
  grid-gap: ${space(1.5)};
  align-items: center;
  justify-items: center;
  padding: ${space(1)};
  margin: 45px 0 45px 0;

  @media (max-width: 1300px) {
    grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  }
`;

const StyledContainer = styled('div')`
  width: 450px;
  padding: 40px 0 40px 0;

  @media (max-width: 1300px) {
    width: 350px;
  }
`;

const ButtonList = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
`;

export default withOrganization(UserFeedbackEmpty);
