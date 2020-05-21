import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {analytics} from 'app/utils/analytics';
import {logException} from 'app/utils/logging';
import {objectIsEmpty} from 'app/utils';
import {t} from 'app/locale';
import CspInterface from 'app/components/events/interfaces/csp';
import DebugMetaInterface from 'app/components/events/interfaces/debugmeta';
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
import SpansInterface from 'app/components/events/interfaces/spans';
import StacktraceInterface from 'app/components/events/interfaces/stacktrace';
import TemplateInterface from 'app/components/events/interfaces/template';
import ThreadsInterface from 'app/components/events/interfaces/threads/threads';
import {DataSection} from 'app/components/events/styles';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import BreadcrumbsInterface from './eventEntriesBreadcrumbs';

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

class EventEntries extends React.Component {
  static propTypes = {
    // Custom shape because shared view doesn't get id.
    organization: PropTypes.shape({
      id: PropTypes.string,
      slug: PropTypes.string.isRequired,
      features: PropTypes.arrayOf(PropTypes.string),
    }),
    // event is not guaranteed in shared issue view
    event: SentryTypes.Event,

    group: SentryTypes.Group,
    project: PropTypes.object.isRequired,
    // TODO(dcramer): ideally isShare would be replaced with simple permission
    // checks
    isShare: PropTypes.bool,
    showExampleCommit: PropTypes.bool,
    showTagSummary: PropTypes.bool,
    eventView: PropTypes.object,
  };

  static defaultProps = {
    isShare: false,
    showExampleCommit: false,
    showTagSummary: true,
  };

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

  shouldComponentUpdate(nextProps) {
    const {event, showExampleCommit} = this.props;

    return (
      (event && nextProps.event && event.id !== nextProps.event.id) ||
      showExampleCommit !== nextProps.showExampleCommit
    );
  }

  recordIssueError(errorTypes, errorMessages) {
    const {organization, project, event} = this.props;
    const orgId = organization.id;
    const platform = project.platform;

    analytics('issue_error_banner.viewed', {
      org_id: parseInt(orgId, 10),
      group: event.groupID,
      error_type: errorTypes,
      error_message: errorMessages,
      ...(platform && {platform}),
    });
  }

  renderEntries() {
    const {event, project, organization, isShare, eventView} = this.props;

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

        // inject additional props for certain interfaces
        const extraProps = {};
        if (entry.type === 'spans' && eventView) {
          extraProps.eventView = eventView;
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
            {...extraProps}
          />
        );
      } catch (ex) {
        logException(ex);
        return (
          <EventDataSection
            projectId={project.slug}
            event={event}
            type={entry.type}
            title={entry.type}
          >
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
        {!objectIsEmpty(event.errors) && <EventErrors event={event} />}{' '}
        {!isShare &&
          (showExampleCommit ? (
            <EventCauseEmpty organization={organization} project={project} />
          ) : (
            <EventCause
              event={event}
              orgId={organization.slug}
              projectId={project.slug}
            />
          ))}
        {event.userReport && group && (
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
          />
        )}
        {this.renderEntries()}
        {hasContext && <EventContexts group={group} event={event} />}
        {!objectIsEmpty(event.context) && <EventExtraData event={event} />}
        {!objectIsEmpty(event.packages) && <EventPackageData event={event} />}
        {!objectIsEmpty(event.device) && <EventDevice event={event} />}
        {!isShare && features.has('event-attachments') && (
          <EventAttachments
            event={event}
            orgId={organization.slug}
            projectId={project.slug}
          />
        )}
        {!objectIsEmpty(event.sdk) && <EventSdk event={event} />}
        {!isShare && event.sdkUpdates && event.sdkUpdates.length > 0 && (
          <EventSdkUpdates event={event} />
        )}
        {!isShare && event.groupID && features.has('grouping-info') && (
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

const BorderlessEventEntries = styled(EventEntries)`
  & ${/* sc-selector */ DataSection} {
    padding: ${space(3)} 0 0 0;
  }
  & ${/* sc-selector */ DataSection}:first-child {
    padding-top: 0;
    border-top: 0;
  }
`;

const StyledEventUserFeedback = styled(EventUserFeedback)`
  border-radius: 0;
  box-shadow: none;
  padding: 20px 30px 0 40px;
  border: 0;
  ${p => (p.includeBorder ? `border-top: 1px solid ${p.theme.borderLight};` : '')}
  margin: 0;
`;

export default withOrganization(withApi(EventEntries));
export {BorderlessEventEntries};
