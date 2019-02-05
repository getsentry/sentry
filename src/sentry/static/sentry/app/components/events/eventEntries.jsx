import PropTypes from 'prop-types';
import React from 'react';

import {analytics} from 'app/utils/analytics';
import {logException} from 'app/utils/logging';
import EventAttachments from 'app/components/events/eventAttachments';
import EventCause from 'app/components/events/eventCause';
import EventContexts from 'app/components/events/contexts';
import EventContextSummary from 'app/components/events/contextSummary';
import EventDataSection from 'app/components/events/eventDataSection';
import EventErrors from 'app/components/events/errors';
import EventExtraData from 'app/components/events/extraData';
import EventPackageData from 'app/components/events/packageData';
import EventTags from 'app/components/events/eventTags';
import EventSdk from 'app/components/events/sdk';
import EventDevice from 'app/components/events/device';
import EventUserFeedback from 'app/components/events/userFeedback';
import SentryTypes from 'app/sentryTypes';
import utils from 'app/utils';
import withOrganization from 'app/utils/withOrganization';
import {t} from 'app/locale';

import ExceptionInterface from 'app/components/events/interfaces/exception';
import MessageInterface from 'app/components/events/interfaces/message';
import RequestInterface from 'app/components/events/interfaces/request';
import StacktraceInterface from 'app/components/events/interfaces/stacktrace';
import TemplateInterface from 'app/components/events/interfaces/template';
import CspInterface from 'app/components/events/interfaces/csp';
import BreadcrumbsInterface from 'app/components/events/interfaces/breadcrumbs';
import GenericInterface from 'app/components/events/interfaces/generic';
import ThreadsInterface from 'app/components/events/interfaces/threads';
import DebugMetaInterface from 'app/components/events/interfaces/debugmeta';

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
};

class EventEntries extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
    orgId: PropTypes.string.isRequired,
    project: PropTypes.object.isRequired,
    // TODO(dcramer): ideally isShare would be replaced with simple permission
    // checks
    isShare: PropTypes.bool,
  };

  static defaultProps = {
    isShare: false,
  };

  componentDidMount() {
    const {event} = this.props;

    if (!event || !event.errors || !(event.errors.length > 0)) return;
    const errors = event.errors;
    const errorTypes = errors.map(errorEntries => errorEntries.type);
    const errorMessages = errors.map(errorEntries => errorEntries.message);

    this.recordIssueError(errorTypes, errorMessages);
  }

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event.id !== nextProps.event.id;
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
    const {event, group, isShare} = this.props;

    return event.entries.map((entry, entryIdx) => {
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
            group={group}
            event={event}
            type={entry.type}
            data={entry.data}
            isShare={isShare}
          />
        );
      } catch (ex) {
        logException(ex);
        return (
          <EventDataSection
            group={group}
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
    const {organization, group, isShare, project, event, orgId} = this.props;

    const features = organization ? new Set(organization.features) : new Set();

    const hasContext =
      event && (!utils.objectIsEmpty(event.user) || !utils.objectIsEmpty(event.contexts));

    if (!event) {
      return (
        <div style={{padding: '15px 30px'}}>
          <h3>{t('Latest Event Not Available')}</h3>
        </div>
      );
    }

    return (
      <div className="entries">
        {!utils.objectIsEmpty(event.errors) && (
          <EventErrors group={group} event={event} />
        )}{' '}
        {!isShare &&
          features.has('suggested-commits') && (
            <EventCause event={event} orgId={orgId} projectId={project.slug} />
          )}
        {event.userReport && (
          <EventUserFeedback
            report={event.userReport}
            orgId={orgId}
            projectId={project.slug}
            issueId={group.id}
          />
        )}
        {hasContext && <EventContextSummary group={group} event={event} />}
        <EventTags
          organization={organization}
          group={group}
          event={event}
          orgId={orgId}
          projectId={project.slug}
        />
        {this.renderEntries()}
        {hasContext && <EventContexts group={group} event={event} />}
        {!utils.objectIsEmpty(event.context) && (
          <EventExtraData group={group} event={event} />
        )}
        {!utils.objectIsEmpty(event.packages) && (
          <EventPackageData group={group} event={event} />
        )}
        {!utils.objectIsEmpty(event.device) && (
          <EventDevice group={group} event={event} />
        )}
        {!isShare &&
          features.has('event-attachments') && (
            <EventAttachments event={event} orgId={orgId} projectId={project.slug} />
          )}
        {!utils.objectIsEmpty(event.sdk) && <EventSdk group={group} event={event} />}
        {!utils.objectIsEmpty(event.sdk) &&
          event.sdk.upstream.isNewer && (
            <div className="alert-block alert-info box">
              <span className="icon-exclamation" />
              {t(
                'This event was reported with an old version of the %s SDK.',
                event.platform
              )}
              {event.sdk.upstream.url && (
                <a href={event.sdk.upstream.url} className="btn btn-sm btn-default">
                  {t('Learn More')}
                </a>
              )}
            </div>
          )}{' '}
      </div>
    );
  }
}

export default withOrganization(EventEntries);
