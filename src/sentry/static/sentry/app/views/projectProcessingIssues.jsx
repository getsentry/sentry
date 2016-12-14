import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import DateTime from '../components/dateTime';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';

const MESSAGES = {
  'native:missing-dsym': t('Missing dSYM file'),
  'native:bad-dsym': t('Bad dSYM file'),
  'native:missing-symbol': t('Missing symbol in dSYM file'),
};

const HELP_LINKS = {
  'native:missing-dsym': 'https://docs.sentry.io/clients/cocoa/dsym/',
  'native:bad-dsym': 'https://docs.sentry.io/clients/cocoa/dsym/',
};


const ProjectProcessingIssues = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      processingIssues: null,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/processingissues/?detailed=1`, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          processingIssues: data,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  renderDebugTable() {
    let body;

    if (this.state.loading)
      body = this.renderLoading();
    else if (this.state.error)
      body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.processingIssues.hasIssues)
      body = this.renderResults();
    else
      body = this.renderEmpty();

    return body;
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('Good news! There are no processing issues.')}</p>
      </div>
    );
  },

  getProblemDescription(item) {
    let msg = MESSAGES[item.type + ':' + item.data.type];
    return msg || item.message || 'Unknown Error';
  },

  getImageName(path) {
    let match = path.match(/\/Frameworks\/(.*?)(\/|$)/);
    if (match) {
      return match[1];
    }
    let pathSegments = path.split(/\//g);
    return pathSegments[pathSegments.length - 1];
  },

  renderProblem(item) {
    let description = this.getProblemDescription(item);
    let helpLink = HELP_LINKS[item.type + ':' + item.data.type];
    return (
      <div className="processing-issue">
        <span className="description">{description}</span>
        {helpLink &&
          <a href={helpLink} className="help-link"><span className="icon-question" /></a>}
      </div>
    );
  },

  renderLocation(item) {
    let dsymUUID = null;
    let dsymName = null;
    let dsymArch = null;

    if (item.type === 'native') {
      if (item.data.image_uuid) {
        dsymUUID = <code className="uuid">{item.data.image_uuid}</code>;
      }
      if (item.data.image_path) {
        dsymName = <em>{this.getImageName(item.data.image_path)}</em>;
      }
      if (item.data.image_arch) {
        dsymArch = item.data.image_arch;
      }
    }

    return (
      <span>
        {dsymUUID && <span> {dsymUUID}</span>}
        {dsymArch && <span> {dsymArch}</span>}
        {dsymName && <span> (for {dsymName})</span>}
      </span>
    );
  },

  renderResults() {
    return (
      <table className="table processing-issues">
        <thead>
          <tr>
            <th>{t('Problem')}</th>
            <th>{t('Location')}</th>
            <th>{t('Issues')}</th>
            <th>{t('Last seen')}</th>
          </tr>
        </thead>
        <tbody>
          {this.state.processingIssues.issues.map((item, idx) => {
            return (
              <tr key={idx}>
                <td>{this.renderProblem(item)}</td>
                <td>{this.renderLocation(item)}</td>
                <td>{item.affectedGroups + ''}</td>
                <td><DateTime date={item.lastSeen}/></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  },

  render() {
    return (
      <div>
        <h1>{t('Processing Issues')}</h1>
        <p>{t(`
          For some platforms the event processing requires configuration or
          manual action.  If a misconfiguration happens or some necessary
          steps are skipped issues can occur during processing.  In these
          cases you can see all the problems here with guides of how to correct
          them.
        `)}</p>
        {this.renderDebugTable()}
      </div>
    );
  }
});

export default ProjectProcessingIssues;
