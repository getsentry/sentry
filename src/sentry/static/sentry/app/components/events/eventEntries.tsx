import * as React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';
import {Location} from 'history';

import {analytics} from 'app/utils/analytics';
import {logException} from 'app/utils/logging';
import {objectIsEmpty} from 'app/utils';
import {t} from 'app/locale';
import CspInterface from 'app/components/events/interfaces/csp';
import DebugMetaInterface from 'app/components/events/interfaces/debugMeta';
import EventAttachments from 'app/components/events/eventAttachments';
import EventCause from 'app/components/events/eventCause';
import EventCauseEmpty from 'app/components/events/eventCauseEmpty';
import EventContextSummary from 'app/components/events/contextSummary/contextSummary';
import EventContexts from 'app/components/events/contexts';
import EventDataSection from 'app/components/events/eventDataSection';
import EventDevice from 'app/components/events/device';
import EventErrors from 'app/components/events/errors';
import EventExtraData from 'app/components/events/eventExtraData/eventExtraData';
import EventGroupingInfo from 'app/components/events/groupingInfo';
import EventPackageData from 'app/components/events/packageData';
import EventSdk from 'app/components/events/eventSdk';
import EventSdkUpdates from 'app/components/events/sdkUpdates';
import EventTags from 'app/components/events/eventTags/eventTags';
import EventUserFeedback from 'app/components/events/userFeedback';
import ExceptionInterface from 'app/components/events/interfaces/exception';
import GenericInterface from 'app/components/events/interfaces/generic';
import MessageInterface from 'app/components/events/interfaces/message';
import RequestInterface from 'app/components/events/interfaces/request';
import RRWebIntegration from 'app/components/events/rrwebIntegration';
import SentryTypes from 'app/sentryTypes';
import BreadcrumbsInterface from 'app/components/events/interfaces/breadcrumbs';
import SpansInterface from 'app/components/events/interfaces/spans';
import StacktraceInterface from 'app/components/events/interfaces/stacktrace';
import TemplateInterface from 'app/components/events/interfaces/template';
import ThreadsInterface from 'app/components/events/interfaces/threads/threads';
import {DataSection} from 'app/components/events/styles';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import {Event, AvatarProject, Group} from 'app/types';

export const INTERFACES = {
  exception: ExceptionInterface,
  message: MessageInterface,
  request: RequestInterface,
  stacktrace: StacktraceInterface,
  template: TemplateInterface,
  csp: CspInterface,
  expectct: GenericInterface,
  expectstaple: GenericInterface,
  hpkp: GenericInterface,
  breadcrumbs: BreadcrumbsInterface,
  threads: ThreadsInterface,
  debugmeta: DebugMetaInterface,
  spans: SpansInterface,
};

const defaultProps = {
  isShare: false,
  showExampleCommit: false,
  showTagSummary: true,
};

// Custom shape because shared view doesn't get id.
type SharedViewOrganization = {
  slug: string;
  id?: string;
  features?: Array<string>;
};

type Props = {
  // This is definitely required because this component would crash if
  // organization were undefined.
  organization: SharedViewOrganization;
  event: Event;
  project: AvatarProject;
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

    const entries = event && event.entries;

    if (!Array.isArray(entries)) {
      return null;
    }

    return entries.map((entry, entryIdx) => {
      try {
        const Component = INTERFACES[entry.type];
        if (!Component) {
          /*eslint no-console:0*/
          window.console &&
            console.error &&
            console.error('Unregistered interface: ' + entry.type);
          return null;
        }

        return (
          <Component
            key={'entry-' + entryIdx}
            projectId={project ? project.slug : null}
            orgId={organization ? organization.slug : null}
            event={event}
            type={entry.type}
            data={entry.data}
            isShare={isShare}
          />
        );
      } catch (ex) {
        logException(ex);
        return (
          <EventDataSection type={entry.type} title={entry.type}>
            <p>{t('There was an error rendering this data.')}</p>
          </EventDataSection>
        );
      }
    });
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
            <EventErrors event={event} />
          </ErrorContainer>
        )}
        {!isShare &&
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
  ${p => (p.includeBorder ? `border-top: 1px solid ${p.theme.borderLight};` : '')}
  margin: 0;
`;

// TODO(ts): any required due to our use of SharedViewOrganization
export default withOrganization<any>(EventEntries);
export {BorderlessEventEntries};
