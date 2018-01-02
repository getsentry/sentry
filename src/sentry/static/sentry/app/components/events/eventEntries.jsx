import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

import {logException} from '../../utils/logging';
import EventContexts from './contexts';
import EventContextSummary from './contextSummary';
import EventDataSection from './eventDataSection';
import EventErrors from './errors';
import EventExtraData from './extraData';
import EventPackageData from './packageData';
import EventTags from './eventTags';
import EventSdk from './sdk';
import EventDevice from './device';
import EventUserReport from './userReport';
import SentryTypes from '../../proptypes';
import utils from '../../utils';
import {t} from '../../locale';

import ExceptionInterface from './interfaces/exception';
import MessageInterface from './interfaces/message';
import RequestInterface from './interfaces/request';
import StacktraceInterface from './interfaces/stacktrace';
import TemplateInterface from './interfaces/template';
import CspInterface from './interfaces/csp';
import BreadcrumbsInterface from './interfaces/breadcrumbs';
import ThreadsInterface from './interfaces/threads';
import DebugMetaInterface from './interfaces/debugmeta';

export const INTERFACES = {
  exception: ExceptionInterface,
  message: MessageInterface,
  request: RequestInterface,
  stacktrace: StacktraceInterface,
  template: TemplateInterface,
  csp: CspInterface,
  breadcrumbs: BreadcrumbsInterface,
  threads: ThreadsInterface,
  debugmeta: DebugMetaInterface,
};

const EventEntries = createReactClass({
  displayName: 'EventEntries',

  propTypes: {
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
    orgId: PropTypes.string.isRequired,
    project: PropTypes.object.isRequired,
    // TODO(dcramer): ideally isShare would be replaced with simple permission
    // checks
    isShare: PropTypes.bool,
  },

  getDefaultProps() {
    return {
      isShare: false,
    };
  },

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event.id !== nextProps.event.id;
  },

  interfaces: INTERFACES,

  render() {
    let {group, isShare, project, event, orgId} = this.props;

    let entries = event.entries.map((entry, entryIdx) => {
      try {
        let Component = this.interfaces[entry.type];
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

    let hasContext =
      !utils.objectIsEmpty(event.user) || !utils.objectIsEmpty(event.contexts);

    let hasContextSummary =
      hasContext &&
      (event.platform === 'cocoa' ||
        event.platform === 'native' ||
        event.platform === 'javascript' ||
        event.platform === 'java');

    return (
      <div className="entries">
        {event.userReport && (
          <EventUserReport
            report={event.userReport}
            orgId={orgId}
            projectId={project.slug}
            issueId={group.id}
          />
        )}
        {!utils.objectIsEmpty(event.errors) && (
          <EventErrors group={group} event={event} />
        )}
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
          )}
        {hasContextSummary && <EventContextSummary group={group} event={event} />}
        <EventTags group={group} event={event} orgId={orgId} projectId={project.slug} />
        {entries}
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
        {!utils.objectIsEmpty(event.sdk) && <EventSdk group={group} event={event} />}
      </div>
    );
  },
});

export default EventEntries;
