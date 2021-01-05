import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import PropTypes from 'prop-types';

import ErrorBoundary from 'app/components/errorBoundary';
import EventContexts from 'app/components/events/contexts';
import EventContextSummary from 'app/components/events/contextSummary/contextSummary';
import EventDevice from 'app/components/events/device';
import EventErrors from 'app/components/events/errors';
import EventAttachments from 'app/components/events/eventAttachments';
import EventCause from 'app/components/events/eventCause';
import EventCauseEmpty from 'app/components/events/eventCauseEmpty';
import EventDataSection from 'app/components/events/eventDataSection';
import EventExtraData from 'app/components/events/eventExtraData/eventExtraData';
import EventSdk from 'app/components/events/eventSdk';
import EventTags from 'app/components/events/eventTags/eventTags';
import EventGroupingInfo from 'app/components/events/groupingInfo';
import EventPackageData from 'app/components/events/packageData';
import RRWebIntegration from 'app/components/events/rrwebIntegration';
import EventSdkUpdates from 'app/components/events/sdkUpdates';
import {DataSection} from 'app/components/events/styles';
import EventUserFeedback from 'app/components/events/userFeedback';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {Group, Organization, Project, SharedViewOrganization} from 'app/types';
import {Entry, Event} from 'app/types/event';
import {isNotSharedOrganization} from 'app/types/utils';
import {objectIsEmpty} from 'app/utils';
import {analytics} from 'app/utils/analytics';
import withOrganization from 'app/utils/withOrganization';

import EventEntry from './eventEntry';

const defaultProps = {
  isShare: false,
  showExampleCommit: false,
  showTagSummary: true,
};

type Props = {
  /**
   * The organization can be the shared view on a public issue view.
   */
  organization: Organization | SharedViewOrganization;
  event: Event;
  project: Project;
  location: Location;

  group?: Group;
  className?: string;
} & typeof defaultProps;

class EventEntries extends React.Component<Props> {
  static propTypes = {
    // Custom shape because shared view doesn't get id.
    organization: PropTypes.shape({
      id: PropTypes.string,
      slug: PropTypes.string.isRequired,
      features: PropTypes.arrayOf(PropTypes.string),
    }).isRequired,
    event: SentryTypes.Event.isRequired,

    group: SentryTypes.Group,
    project: PropTypes.object.isRequired,
    // TODO(dcramer): ideally isShare would be replaced with simple permission
    // checks
    isShare: PropTypes.bool,
    showExampleCommit: PropTypes.bool,
    showTagSummary: PropTypes.bool,
  };

  static defaultProps = defaultProps;

  componentDidMount() {
    const {event} = this.props;

    if (!event || !event.errors || !(event.errors.length > 0)) {
      return;
    }
    const errors = event.errors;
    const errorTypes = errors.map(errorEntries => errorEntries.type);
    const errorMessages = errors.map(errorEntries => errorEntries.message);

    this.recordIssueError(errorTypes, errorMessages);
  }

  shouldComponentUpdate(nextProps: Props) {
    const {event, showExampleCommit} = this.props;

    return (
      (event && nextProps.event && event.id !== nextProps.event.id) ||
      showExampleCommit !== nextProps.showExampleCommit
    );
  }

  recordIssueError(errorTypes: any[], errorMessages: string[]) {
    const {organization, project, event} = this.props;

    const orgId = organization.id;
    const platform = project.platform;

    analytics('issue_error_banner.viewed', {
      org_id: orgId ? parseInt(orgId, 10) : null,
      group: event?.groupID,
      error_type: errorTypes,
      error_message: errorMessages,
      ...(platform && {platform}),
    });
  }

  renderEntries() {
    const {event, project, organization, isShare} = this.props;

    const entries = event?.entries;

    if (!Array.isArray(entries)) {
      return null;
    }

    return (entries as Array<Entry>).map((entry, entryIdx) => (
      <ErrorBoundary
        key={`entry-${entryIdx}`}
        customComponent={
          <EventDataSection type={entry.type} title={entry.type}>
            <p>{t('There was an error rendering this data.')}</p>
          </EventDataSection>
        }
      >
        <EventEntry
          projectSlug={project.slug}
          organization={organization}
          event={event}
          entry={entry}
          isShare={isShare}
        />
      </ErrorBoundary>
    ));
  }

  render() {
    const {
      className,
      organization,
      group,
      isShare,
      project,
      event,
      showExampleCommit,
      showTagSummary,
      location,
    } = this.props;

    const features =
      organization && organization.features ? new Set(organization.features) : new Set();
    const hasQueryFeature = features.has('discover-query');

    if (!event) {
      return (
        <div style={{padding: '15px 30px'}}>
          <h3>{t('Latest Event Not Available')}</h3>
        </div>
      );
    }
    const hasContext = !objectIsEmpty(event.user) || !objectIsEmpty(event.contexts);
    const hasErrors = !objectIsEmpty(event.errors);

    return (
      <div className={className} data-test-id="event-entries">
        {hasErrors && (
          <ErrorContainer>
            <EventErrors
              event={event}
              orgSlug={organization.slug}
              projectSlug={project.slug}
            />
          </ErrorContainer>
        )}
        {!isShare &&
          isNotSharedOrganization(organization) &&
          (showExampleCommit ? (
            <EventCauseEmpty organization={organization} project={project} />
          ) : (
            <EventCause
              organization={organization}
              project={project}
              event={event}
              group={group}
            />
          ))}
        {event?.userReport && group && (
          <StyledEventUserFeedback
            report={event.userReport}
            orgId={organization.slug}
            issueId={group.id}
            includeBorder={!hasErrors}
          />
        )}
        {hasContext && showTagSummary && <EventContextSummary event={event} />}
        {showTagSummary && (
          <EventTags
            event={event}
            orgId={organization.slug}
            projectId={project.slug}
            location={location}
            hasQueryFeature={hasQueryFeature}
          />
        )}
        {this.renderEntries()}
        {hasContext && <EventContexts group={group} event={event} />}
        {event && !objectIsEmpty(event.context) && <EventExtraData event={event} />}
        {event && !objectIsEmpty(event.packages) && <EventPackageData event={event} />}
        {event && !objectIsEmpty(event.device) && <EventDevice event={event} />}
        {!isShare && features.has('event-attachments') && (
          <EventAttachments
            event={event}
            orgId={organization.slug}
            projectId={project.slug}
            location={location}
          />
        )}
        {event?.sdk && !objectIsEmpty(event.sdk) && <EventSdk sdk={event.sdk} />}
        {!isShare && event?.sdkUpdates && event.sdkUpdates.length > 0 && (
          <EventSdkUpdates event={{sdkUpdates: event.sdkUpdates, ...event}} />
        )}
        {!isShare && event?.groupID && (
          <EventGroupingInfo
            projectId={project.slug}
            event={event}
            showGroupingConfig={features.has('set-grouping-config')}
          />
        )}
        {!isShare && features.has('event-attachments') && (
          <RRWebIntegration
            event={event}
            orgId={organization.slug}
            projectId={project.slug}
          />
        )}
      </div>
    );
  }
}

const ErrorContainer = styled('div')`
  /*
  Remove border on adjacent context summary box.
  Once that component uses emotion this will be harder.
  */
  & + .context-summary {
    border-top: none;
  }
`;

const BorderlessEventEntries = styled(EventEntries)`
  & ${/* sc-selector */ DataSection} {
    padding: ${space(3)} 0 0 0;
  }
  & ${/* sc-selector */ DataSection}:first-child {
    padding-top: 0;
    border-top: 0;
  }
  & ${/* sc-selector */ ErrorContainer} {
    margin-bottom: ${space(2)};
  }
`;

type StyledEventUserFeedbackProps = {
  includeBorder: boolean;
};

const StyledEventUserFeedback = styled(EventUserFeedback)<StyledEventUserFeedbackProps>`
  border-radius: 0;
  box-shadow: none;
  padding: 20px 30px 0 40px;
  border: 0;
  ${p => (p.includeBorder ? `border-top: 1px solid ${p.theme.innerBorder};` : '')}
  margin: 0;
`;

// TODO(ts): any required due to our use of SharedViewOrganization
export default withOrganization<any>(EventEntries);
export {BorderlessEventEntries};
