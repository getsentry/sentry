import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';
import * as Sentry from '@sentry/browser';

import {t} from 'app/locale';
import Button from 'app/components/button';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import withOrganization from 'app/utils/withOrganization';

class UserFeedbackEmpty extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    projectIds: PropTypes.arrayOf(PropTypes.string.isRequired),
  };

  get hasAnyFeedback() {
    const {
      organization: {projects},
      projectIds,
    } = this.props;

    let selectedProjects = projects;

    if (projectIds && projectIds.length) {
      selectedProjects = selectedProjects.filter(({id}) => projectIds.includes(id));
    }

    return selectedProjects.some(
      ({hasAccess, hasUserReports}) => hasAccess && !!hasUserReports
    );
  }

  trackAnalytics({eventKey, eventName}) {
    const {organization} = this.props;
    const {projects} = organization;

    trackAnalyticsEvent({
      eventKey,
      eventName,
      organization_id: parseInt(organization.id, 10),
      projects,
    });
  }

  render() {
    if (this.hasAnyFeedback === false) {
      return (
        <UserFeedbackLanding>
          <StyledContainer>{/* Placeholder for dreamy component */}</StyledContainer>

          <StyledContainer>
            <h3>{t('No User Feedback Collected')}</h3>
            <p>
              {t(
                'User Feedback allows you to interact with your users, collect additional details about the issues impacting them, and reach out with resolutions'
              )}
            </p>
            <ButtonList>
              <Button
                onClick={() =>
                  this.trackAnalytics({
                    eventKey: 'user_feedback.docs_clicked',
                    eventName: 'User Feedback Docs Clicked',
                  })
                }
                href="https://docs.sentry.io/enriching-error-data/user-feedback/"
                target="_blank"
                rel="noreferrer noopener"
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
                {t('See the report dialog')}
              </Button>
            </ButtonList>
          </StyledContainer>
        </UserFeedbackLanding>
      );
    }

    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no user reports match your filters.')}</p>
      </EmptyStateWarning>
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
