import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import uniqWith from 'lodash/uniqWith';
import isEqual from 'lodash/isEqual';
import {browserHistory} from 'react-router';

import {openModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import EventErrorItem from 'app/components/events/errorItem';
import {Event, AvatarProject, Project} from 'app/types';
import {IconWarning} from 'app/icons';
import {t, tct, tn} from 'app/locale';
import space from 'app/styles/space';
import NumberField from 'app/components/forms/numberField';
import ApiForm from 'app/components/forms/apiForm';
import Alert from 'app/components/alert';
import ExternalLink from 'app/components/links/externalLink';

import {BannerContainer, BannerSummary} from './styles';

const MAX_ERRORS = 100;

type Props = {
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

  onReprocessGroup = () => {
    const {orgId, issueId} = this.props;
    browserHistory.push(
      `/organizations/${orgId}/issues/?query=tags[original_group_id]:${issueId}`
    );
  };

  onReprocessStart = () => {
    openModal(this.renderReprocessModal);
  };

  renderReprocessModal = ({Body, closeModal}) => {
    const {orgId, issueId} = this.props;

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
              {tct(
                'Sentry will [strong:duplicate events in your project, assign new event IDs and delete the old issue.] This may temporarily affect event counts in graphs all across the product. Eventually we will not assign new event IDs.',
                {strong: <strong />}
              )}
            </li>
            <li>
              {tct(
                'Reprocessing one or multiple events [strong:counts against your quota], but bypasses rate limits.',
                {strong: <strong />}
              )}
            </li>
            <li>
              {tct(
                'If you have provided missing symbols [strong:please wait at least 1 hour before attempting to re-process.] This is a limitation we will try to get rid of.',
                {strong: <strong />}
              )}
            </li>
            <li>
              {tct(
                'Reprocessed events will not trigger issue alerts, and reprocessed events will not be subject to [link:data forwarding].',
                {
                  fwd: (
                    <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=/data-management/data-forwarding/" />
                  ),
                }
              )}
            </li>
          </ul>

          <Alert type="warning">
            {t(
              'Reprocessing is still in open beta. Make sure you understand what the above means for you, and beware of bugs.'
            )}
          </Alert>

          <ApiForm
            apiEndpoint={`/organizations/${orgId}/issues/${issueId}/reprocessing/`}
            apiMethod="POST"
            footerClass="modal-footer"
            onSubmitSuccess={this.onReprocessGroup}
            submitLabel={t('Reprocess')}
            submitLoadingMessage={t('Reprocessing\u2026')}
            submitErrorMessage={t('Failed to reprocess. Please check your input.')}
            hideErrors
            onCancel={closeModal}
          >
            <NumberField
              name="maxEvents"
              label={t('Reprocess n latest events, delete the rest')}
              placeholder={t('all events')}
              min={1}
            />
          </ApiForm>
        </Body>
      </React.Fragment>
    );
  };

  render() {
    const {event, project, issueId} = this.props;
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

          {(project as Project)?.features?.includes('reprocessing-v2') && issueId && (
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

export default EventErrors;
