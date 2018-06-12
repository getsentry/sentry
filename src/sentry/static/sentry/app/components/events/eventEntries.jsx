import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

import {logException} from 'app/utils/logging';
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
import EventUserReport from 'app/components/events/userReport';
import SentryTypes from 'app/proptypes';
import GroupState from 'app/mixins/groupState';
import utils from 'app/utils';
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

import ApiMixin from 'app/mixins/apiMixin'; // I added this

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
    release: PropTypes.string,
  },

  mixins: [GroupState, ApiMixin],

  getDefaultProps() {
    return {
      isShare: false,
    };
  },

  getInitialState() {
    return {
      loading: true,
      error: false,
      fileList: [],
      pageLinks: null,
    };
  },

  componentDidMount() {
    this.fetchData(); // I added this
  },

  shouldComponentUpdate(nextProps, nextState) {
    return (
      this.props.event.id !== nextProps.event.id ||
      this.state.loading !== nextState.loading
    );
  },

  getFilesEndpoint() {
    let params = this.context;
    let release = this.props.release;
    return `/projects/${params.organization.slug}/${params.project
      .slug}/releases/${encodeURIComponent(release)}/files/`;
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    this.api.request(this.getFilesEndpoint(), {
      method: 'GET',
      data: {},
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          fileList: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  //////////////////// I added this

  compareFiles(fileList, stackTraceFiles) {
    // compare the file list from artifacts against the culprit in the stack trace
    // figure out how to send this to the error banner rather than console.logging

    // if (typeof(fileListSize) === 'undefined') {
    //   console.log("We don't have any of your files! Upload em");
    // } else { // we have either the map OR the min, figure out which and message appropriately
    //   if (typeof stackTraceFile !== 'undefined') { // we have stackTraceFiles
    //     if (stackTraceFile.endsWith('.map')) {
    //       console.log('We only have your map file. You need to upload the min');
    //     } else {
    //       console.log('We only have your min file. You need to upload the map');
    //     }
    //   } else {
    //     // strip the file path from one file and compare
    //     let file = fileListFile.replace(/^.*[\\\/]/, '');
    //     if (stackTraceFile.indexOf(file) >= 0) {
    //       console.log('They match!');
    //     } else {
    //       console.log('They do not match');
    //     }
    //   }
    // }
    if (fileList.length === 0) {
      console.log('Upload artifacts!');
    } else {
      for (let i = stackTraceFiles.length - 1; i > 0; i--) {
        let test = stackTraceFiles[i].replace(/^.*[\\\/]/, '');
        console.log('looppol', test, fileList);
        if (fileList.includes(stackTraceFiles[i])) {
          console.log(
            'The filenames match but I still need to check the extensions and stuff'
          );
        } else {
          console.log("The filenames don't match");
        }
      }
    }
  },

  interfaces: INTERFACES,

  render() {
    // let fileList = this.state.fileList; // the artifacts matching the release
    const fileList = this.state.fileList.map(x => x.name);
    console.log('The artifacts: ', fileList);

    const stackTraceFiles = this.props.event.entries[0].data.values[0].stacktrace.frames.map(
      x => x.filename
    );
    console.log('The stack trace files: ', stackTraceFiles);

    let errorType = this.props.event.errors[0].type;
    // probably going to add other error types in later
    if (errorType === 'fetch_invalid_http_code') {
      this.compareFiles(fileList, stackTraceFiles);
    }

    let {group, isShare, project, event, orgId} = this.props;
    let organization = this.getOrganization();
    let features = organization ? new Set(organization.features) : new Set();
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

    return (
      <div className="entries">
        {!utils.objectIsEmpty(event.errors) && (
          <EventErrors
            group={group}
            event={event}
            sourcemap-issue={this.isThereSourcemapIssue}
          />
        )}{' '}
        {!isShare &&
          features.has('suggested-commits') && (
            <EventCause event={event} orgId={orgId} projectId={project.slug} />
          )}
        {event.userReport && (
          <EventUserReport
            report={event.userReport}
            orgId={orgId}
            projectId={project.slug}
            issueId={group.id}
          />
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
        {hasContext && <EventContextSummary group={group} event={event} />}
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
