import React from 'react';

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
import PropTypes from '../../proptypes';
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

export const INTERFACES = {
  exception: ExceptionInterface,
  message: MessageInterface,
  request: RequestInterface,
  stacktrace: StacktraceInterface,
  template: TemplateInterface,
  csp: CspInterface,
  breadcrumbs: BreadcrumbsInterface,
  threads: ThreadsInterface,
};

const EventEntries = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    orgId: React.PropTypes.string.isRequired,
    project: React.PropTypes.object.isRequired,
    // TODO(dcramer): ideally isShare would be replaced with simple permission
    // checks
    isShare: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      isShare: false
    };
  },

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event.id !== nextProps.event.id;
  },

  interfaces: INTERFACES,

  render() {
    let group = this.props.group;
    let evt = this.props.event;
    let isShare = this.props.isShare;
    let project = this.props.project;

    let entries = evt.entries.map((entry, entryIdx) => {
      try {
        let Component = this.interfaces[entry.type];
        if (!Component) {
          /*eslint no-console:0*/
          window.console && console.error && console.error('Unregistered interface: ' + entry.type);
          return null;
        }
        return (
          <Component
            key={'entry-' + entryIdx}
            group={group}
            event={evt}
            type={entry.type}
            data={entry.data}
            isShare={isShare} />
        );
      } catch (ex) {
        logException(ex);
        return (
          <EventDataSection
              group={group}
              event={evt}
              type={entry.type}
              title={entry.type}>
            <p>{t('There was an error rendering this data.')}</p>
          </EventDataSection>
        );
      }
    });

    let hasContext = (
      !utils.objectIsEmpty(evt.user) || !utils.objectIsEmpty(evt.contexts)
    );

    let hasContextSummary = (
      hasContext && (evt.platform === 'cocoa' || evt.platform === 'javascript')
    );

    return (
      <div className="entries">
        {evt.userReport &&
          <EventUserReport
            group={group}
            event={evt} />
        }
        {!utils.objectIsEmpty(evt.errors) &&
          <EventErrors
            group={group}
            event={evt} />
        }
        {!utils.objectIsEmpty(evt.sdk) && evt.sdk.upstream.isNewer &&
          <div className="alert-block alert-info box">
            <span className="icon-exclamation"/>
            {t('This event was reported with an old version of the %s SDK.', evt.platform)}
            {evt.sdk.upstream.url &&
              <a href={evt.sdk.upstream.url}
                 className="btn btn-sm btn-default">{t('Learn More')}</a>
            }
          </div>
        }
        {hasContextSummary &&
          <EventContextSummary
            group={group}
            event={evt} />
        }
        <EventTags
          group={group}
          event={evt}
          orgId={this.props.orgId}
          projectId={project.slug} />
        {entries}
        {hasContext &&
          <EventContexts
            group={group}
            event={evt} />
        }
        {!utils.objectIsEmpty(evt.context) &&
          <EventExtraData
            group={group}
            event={evt} />
        }
        {!utils.objectIsEmpty(evt.packages) &&
          <EventPackageData
            group={group}
            event={evt} />
        }
        {!utils.objectIsEmpty(evt.device) &&
          <EventDevice
            group={group}
            event={evt} />
        }
        {!utils.objectIsEmpty(evt.sdk) &&
          <EventSdk
            group={group}
            event={evt} />
        }
      </div>
    );
  }
});

export default EventEntries;
