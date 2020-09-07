import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import uniqWith from 'lodash/uniqWith';
import isEqual from 'lodash/isEqual';
import {browserHistory} from 'react-router';

import {openModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import EventErrorItem from 'app/components/events/errorItem';
import {Event, AvatarProject, Project} from 'app/types';
import {IconWarning} from 'app/icons';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

import {BannerContainer, BannerSummary} from './styles';

const MAX_ERRORS = 100;

type Props = {
  api: Client;
  event: Event;
  orgId: string;
  project: AvatarProject | Project;
  issueId?: string;
};

type State = {
  isOpen: boolean;
};

class EventErrors extends React.Component<Props, State> {
  static propTypes: any = {
    api: PropTypes.object.isRequired,
    event: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    project: PropTypes.object.isRequired,
    issueId: PropTypes.string,
  };

  state: State = {
    isOpen: false,
  };

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    if (this.state.isOpen !== nextState.isOpen) {
      return true;
    }
    return this.props.event.id !== nextProps.event.id;
  }

  toggle = () => {
    this.setState(state => ({isOpen: !state.isOpen}));
  };

  uniqueErrors = (errors: any[]) => uniqWith(errors, isEqual);

  onReprocessEvent = async () => {
    const {api, orgId, project, event} = this.props;
    const endpoint = `/projects/${orgId}/${project.slug}/events/${event.id}/reprocessing/`;

    addLoadingMessage(t('Reprocessing event\u2026'));

    try {
      await api.requestPromise(endpoint, {
        method: 'POST',
      });
    } catch {
      clearIndicators();
      addErrorMessage(
        t('Failed to start reprocessing. The event is likely too far in the past.')
      );
      return;
    }

    clearIndicators();
    browserHistory.push(
      `/organizations/${orgId}/issues/?query=tags[original_event_id]:${event.id}`
    );
  };

  onReprocessGroup = async (issueId: string) => {
    const {api, orgId} = this.props;
    const endpoint = `/organizations/${orgId}/issues/${issueId}/reprocessing/`;

    addLoadingMessage(t('Reprocessing issue\u2026'));

    try {
      await api.requestPromise(endpoint, {
        method: 'POST',
      });
    } catch {
      clearIndicators();
      addErrorMessage(
        t('Failed to start reprocessing. The event is likely too far in the past.')
      );
      return;
    }

    clearIndicators();
    browserHistory.push(
      `/organizations/${orgId}/issues/?query=tags[original_group_id]:${issueId}`
    );
  };

  onReprocessStart = () => {
    openModal(this.renderReprocessModal);
  };

  renderReprocessModal = ({Body, closeModal, Footer}) => {
    const {issueId} = this.props;
    return (
      <React.Fragment>
        <Body>
          <p>
            {t(
              'You can choose to re-process events to see if your errors have been resolved. Keep the following limitations in mind:'
            )}
          </p>

          <ul>
            <li>
              {t(
                'Sentry will duplicate events in your project (for now) and not delete the old versions.'
              )}
            </li>
            <li>
              {t(
                'Reprocessing one or multiple events counts against your quota, but bypasses rate limits.'
              )}
            </li>
            <li>
              {t(
                'If an event is reprocessed but did not change, we will not create the new version and not bill you for it (for now).'
              )}
            </li>
            <li>
              {t(
                'If you have provided missing symbols please wait at least 1 hour before attempting to re-process. This is a limitation we will try to get rid of.'
              )}
            </li>
          </ul>
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            {issueId && (
              <Button onClick={() => this.onReprocessGroup(issueId)}>
                {t('Reprocess all events in issue')}
              </Button>
            )}
            <Button onClick={this.onReprocessEvent}>{t('Reprocess single event')}</Button>
            <Button onClick={closeModal}>{t('Cancel')}</Button>
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  };

  render() {
    const {event, project} = this.props;
    // XXX: uniqueErrors is not performant with large datasets
    const errors =
      event.errors.length > MAX_ERRORS ? event.errors : this.uniqueErrors(event.errors);

    const numErrors = errors.length;
    const isOpen = this.state.isOpen;
    return (
      <StyledBanner priority="danger">
        <BannerSummary>
          <StyledIconWarning />
          <span>
            {tn(
              'There was %s error encountered while processing this event',
              'There were %s errors encountered while processing this event',
              numErrors
            )}
          </span>
          <a data-test-id="event-error-toggle" onClick={this.toggle}>
            {isOpen ? t('Hide') : t('Show')}
          </a>
        </BannerSummary>
        <ErrorList
          data-test-id="event-error-details"
          style={{display: isOpen ? 'block' : 'none'}}
        >
          {errors.map((error, errorIdx) => (
            <EventErrorItem key={errorIdx} error={error} />
          ))}

          {'features' in project && project.features.includes('reprocessing-v2') && (
            <Button size="xsmall" onClick={this.onReprocessStart}>
              {t('Try again')}
            </Button>
          )}
        </ErrorList>
      </StyledBanner>
    );
  }
}

const StyledBanner = styled(BannerContainer)`
  margin-top: -1px;

  a {
    font-weight: bold;
    color: ${p => p.theme.gray600};
    &:hover {
      color: ${p => p.theme.gray700};
    }
  }
`;

const StyledIconWarning = styled(IconWarning)`
  color: ${p => p.theme.red400};
`;

// TODO(theme) don't use a custom pink
const customPink = '#e7c0bc';

const ErrorList = styled('ul')`
  border-top: 1px solid ${customPink};
  margin: 0 ${space(3)} 0 ${space(4)};
  padding: ${space(1)} 0 ${space(0.5)} ${space(4)};

  li {
    margin-bottom: ${space(0.75)};
    word-break: break-word;
  }

  pre {
    background: #f9eded;
    color: #381618;
    margin: ${space(0.5)} 0 0;
  }
`;

export default withApi<Props>(EventErrors);
