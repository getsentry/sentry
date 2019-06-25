import React from 'react';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import {omit} from 'lodash';
import {css} from 'react-emotion';

import SentryTypes from 'app/sentryTypes';
import AsyncComponent from 'app/components/asyncComponent';
import ModalDialog from 'app/components/modalDialog';
import withApi from 'app/utils/withApi';
import theme from 'app/utils/theme';
import space from 'app/styles/space';

import EventModalContent from './eventModalContent';

const modalStyles = css`
  top: 0px;
  left: 0px;
  right: 0px;

  margin: ${space(3)};
  padding: ${space(3)};

  @media (max-width: ${theme.breakpoints[1]}) {
    margin: ${space(2)};
  }
`;

class BuildEvent extends AsyncComponent {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    eventId: PropTypes.string.isRequired,
    build: SentryTypes.Build.isRequired,
  };

  getEndpoints() {
    const {orgId, projectId, eventId} = this.props;

    return [
      [
        'event',
        `/organizations/${orgId}/events/latest/`,
        {
          query: {
            query: `build.id:${buildId}`,
          },
        },
      ],
    ];
  }

  onDismiss = () => {
    const {location} = this.props;
    // Remove modal related query parameters.
    const query = omit(location.query, ['groupSlug', 'eventSlug']);

    browserHistory.push({
      pathname: location.pathname,
      query,
    });
  };

  renderBody() {
    const {organization, view, location} = this.props;
    const {event} = this.state;

    return (
      <ModalDialog onDismiss={this.onDismiss} className={modalStyles}>
        <EventModalContent
          onTabChange={this.handleTabChange}
          event={event}
          projectId={this.projectId}
          organization={organization}
          view={view}
          location={location}
        />
      </ModalDialog>
    );
  }

  renderLoading() {
    return (
      <ModalDialog onDismiss={this.onDismiss} className={modalStyles}>
        {super.renderLoading()}
      </ModalDialog>
    );
  }
}

export default withApi(BuildEvent);
