import React from 'react';
import createReactClass from 'create-react-class';

import {addLoadingMessage, removeIndicator} from '../../../actionCreators/indicator';
import {t, tn} from '../../../locale';
import formGroups from '../../../data/forms/processingIssues';
import ApiMixin from '../../../mixins/apiMixin';
import Form from '../components/forms/form';
import JsonForm from '../components/forms/jsonForm';
import LoadingError from '../../../components/loadingError';
import LoadingIndicator from '../../../components/loadingIndicator';
import OrganizationState from '../../../mixins/organizationState';
import SettingsPageHeader from '../components/settingsPageHeader';
import TextBlock from '../components/text/textBlock';
import TimeSince from '../../../components/timeSince';
import EmptyStateWarning from '../../../components/emptyStateWarning';
import {Panel} from '../../../components/panels';

const MESSAGES = {
  native_no_crashed_thread: t('No crashed thread found in crash report'),
  native_internal_failure: t('Internal failure when attempting to symbolicate: {error}'),
  native_bad_dsym: t('The debug information file used was broken.'),
  native_missing_optionally_bundled_dsym: t(
    'An optional debug information file was missing.'
  ),
  native_missing_dsym: t('A required debug information file was missing.'),
  native_missing_system_dsym: t('A system debug information file was missing.'),
  native_missing_symbol: t('Unable to resolve a symbol.'),
  native_simulator_frame: t('Encountered an unprocessable simulator frame.'),
  native_unknown_image: t('A binary image is referenced that is unknown.'),
  proguard_missing_mapping: t('A proguard mapping file was missing.'),
  proguard_missing_lineno: t('A proguard mapping file does not contain line info.'),
};

const HELP_LINKS = {
  native_missing_dsym: 'https://docs.sentry.io/clients/cocoa/dsym/',
  native_bad_dsym: 'https://docs.sentry.io/clients/cocoa/dsym/',
  native_missing_system_dsym: 'https://docs.sentry.io/server/dsym/',
  native_missing_symbol: 'https://docs.sentry.io/server/dsym/',
};

const ProjectProcessingIssues = createReactClass({
  displayName: 'ProjectProcessingIssues',
  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      formData: {},
      loading: true,
      reprocessing: false,
      expected: 0,
      error: false,
      processingIssues: null,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.setState({
      expected: this.state.expected + 2,
    });
    this.api.request(`/projects/${orgId}/${projectId}/`, {
      success: (data, _, jqXHR) => {
        let expected = this.state.expected - 1;
        this.setState({
          expected,
          loading: expected > 0,
          formData: data.options,
        });
      },
      error: () => {
        let expected = this.state.expected - 1;
        this.setState({
          expected,
          error: true,
          loading: expected > 0,
        });
      },
    });

    this.api.request(`/projects/${orgId}/${projectId}/processingissues/?detailed=1`, {
      success: (data, _, jqXHR) => {
        let expected = this.state.expected - 1;
        this.setState({
          expected,
          error: false,
          loading: expected > 0,
          processingIssues: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        let expected = this.state.expected - 1;
        this.setState({
          expected,
          error: true,
          loading: expected > 0,
        });
      },
    });
  },

  sendReprocessing() {
    this.setState({
      reprocessing: true,
    });
    let loadingIndicator = addLoadingMessage(t('Started reprocessing..'));
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/reprocessing/`, {
      method: 'POST',
      success: (data, _, jqXHR) => {
        this.fetchData();
        this.setState({
          reprocessing: false,
        });
      },
      error: () => {
        this.setState({
          reprocessing: false,
        });
      },
      complete: () => {
        removeIndicator(loadingIndicator);
      },
    });
  },

  discardEvents() {
    let {orgId, projectId} = this.props.params;
    this.setState({
      expected: this.state.expected + 1,
    });
    // Note: inconsistency with missing trailing slash, but matches route in backend
    this.api.request(`/projects/${orgId}/${projectId}/processingissues/discard`, {
      method: 'DELETE',
      success: (data, _, jqXHR) => {
        let expected = this.state.expected - 1;
        this.setState({
          expected,
          error: false,
          loading: expected > 0,
        });
        // TODO (billyvg): Need to fix this
        // we reload to get rid of the badge in the sidebar
        window.location.reload();
      },
      error: () => {
        let expected = this.state.expected - 1;
        this.setState({
          expected,
          error: true,
          loading: expected > 0,
        });
      },
    });
  },

  deleteProcessingIssues() {
    let {orgId, projectId} = this.props.params;
    this.setState({
      expected: this.state.expected + 1,
    });
    this.api.request(`/projects/${orgId}/${projectId}/processingissues/`, {
      method: 'DELETE',
      success: (data, _, jqXHR) => {
        let expected = this.state.expected - 1;
        this.setState({
          expected,
          error: false,
          loading: expected > 0,
        });
        // TODO (billyvg): Need to fix this
        // we reload to get rid of the badge in the sidebar
        window.location.reload();
      },
      error: () => {
        let expected = this.state.expected - 1;
        this.setState({
          expected,
          error: true,
          loading: expected > 0,
        });
      },
    });
  },

  renderDebugTable() {
    let body;

    if (this.state.loading) body = this.renderLoading();
    else if (this.state.error) body = <LoadingError onRetry={this.fetchData} />;
    else if (
      this.state.processingIssues.hasIssues ||
      this.state.processingIssues.resolveableIssues
    )
      body = this.renderResults();
    else body = this.renderEmpty();

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
      <Panel>
        <EmptyStateWarning>
          <p>{t('Good news! There are no processing issues.')}</p>
        </EmptyStateWarning>
      </Panel>
    );
  },

  getProblemDescription(item) {
    let msg = MESSAGES[item.type];
    return msg || item.message || 'Unknown Error';
  },

  getImageName(path) {
    let pathSegments = path.split(/^[a-z]:\\/i.test(path) ? '\\' : '/');
    return pathSegments[pathSegments.length - 1];
  },

  renderProblem(item) {
    let description = this.getProblemDescription(item);
    let helpLink = HELP_LINKS[item.type];
    return (
      <div className="processing-issue">
        <span className="description">{description}</span>{' '}
        {helpLink && (
          <a href={helpLink} className="help-link">
            <span className="icon-question" />
          </a>
        )}
      </div>
    );
  },

  renderDetails(item) {
    let dsymUUID = null;
    let dsymName = null;
    let dsymArch = null;

    if (item.data._scope === 'native') {
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

  renderResolveButton() {
    let issues = this.state.processingIssues;
    if (issues === null || this.state.reprocessing) {
      return null;
    }
    if (issues.resolveableIssues <= 0) {
      return null;
    }
    let fixButton = tn(
      'Click here to trigger processing for %d pending event',
      'Click here to trigger processing for %d pending events',
      issues.resolveableIssues
    );
    return (
      <div className="alert alert-block alert-info">
        Pro Tip: <a onClick={this.sendReprocessing}>{fixButton}</a>
      </div>
    );
  },

  renderResults() {
    const fixLink = this.state.processingIssues
      ? this.state.processingIssues.signedLink
      : false;

    let fixLinkBlock = null;
    if (fixLink) {
      fixLinkBlock = (
        <div className="panel panel-info">
          <div className="panel-heading">
            <h3>{t('Having trouble uploading debug informations? We can help!')}</h3>
          </div>
          <div className="panel-body">
            <div className="form-group" style={{marginBottom: 0}}>
              <label>
                {t(
                  "Paste this command into your shell and we'll attempt to upload the missing symbols from your machine:"
                )}
              </label>
              <div
                className="form-control disabled auto-select"
                style={{marginBottom: 6}}
              >
                curl -sL {fixLink} | bash
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div>
        {fixLinkBlock}
        <h3>
          {t('Pending Issues')}
          <a
            className="btn btn-default btn-sm pull-right"
            onClick={() => {
              this.discardEvents();
            }}
          >
            {t('Discard all')}
          </a>
        </h3>
        <div className="panel panel-default">
          <div className="panel-heading panel-heading-bold hidden-xs">
            <div className="row">
              <div className="col-sm-3">{t('Problem')}</div>
              <div className="col-sm-5">{t('Details')}</div>
              <div className="col-sm-2">{t('Events')}</div>
              <div className="col-sm-2">{t('Last seen')}</div>
            </div>
          </div>
          <div className="list-group">
            {this.state.processingIssues.issues.map((item, idx) => {
              return (
                <div key={idx} className="list-group-item">
                  <div className="row row-flex row-center-vertically">
                    <div className="col-sm-3">{this.renderProblem(item)}</div>
                    <div className="col-sm-5">{this.renderDetails(item)}</div>
                    <div className="col-sm-2">{item.numEvents + ''}</div>
                    <div className="col-sm-2">
                      <TimeSince date={item.lastSeen} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  },

  renderReprocessingSettings() {
    let access = this.getAccess();
    if (this.state.loading) {
      return this.renderLoading();
    }

    let {formData} = this.state;
    let {orgId, projectId} = this.props.params;
    return (
      <Form
        saveOnBlur
        onSubmitSuccess={this.deleteProcessingIssues}
        apiEndpoint={`/projects/${orgId}/${projectId}/`}
        apiMethod="PUT"
        initialData={formData}
      >
        <JsonForm access={access} forms={formGroups} />
      </Form>
    );
  },

  render() {
    return (
      <div>
        <SettingsPageHeader title={t('Processing Issues')} />
        <TextBlock>
          {t(
            `
          For some platforms the event processing requires configuration or
          manual action.  If a misconfiguration happens or some necessary
          steps are skipped issues can occur during processing.  In these
          cases you can see all the problems here with guides of how to correct
          them.
        `
          )}
        </TextBlock>
        {this.renderDebugTable()}
        {this.renderResolveButton()}
        {this.renderReprocessingSettings()}
      </div>
    );
  },
});

export default ProjectProcessingIssues;
