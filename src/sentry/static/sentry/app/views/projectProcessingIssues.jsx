import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import TimeSince from '../components/timeSince';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import IndicatorStore from '../stores/indicatorStore';
import {FormState, BooleanField} from '../components/forms';
import Switch from '../components/switch';
import {t, tn} from '../locale';

const MESSAGES = {
    'native_no_crashed_thread': t('No crashed thread found in crash report'),
    'native_internal_failure': t('Internal failure when attempting to symbolicate: {error}'),
    'native_no_symsynd': t('The symbolizer is not configured for this system.'),
    'native_bad_dsym': t('The debug symbol file used was broken.'),
    'native_missing_optionally_bundled_dsym': t('An optional debug symbol file was missing.'),
    'native_missing_dsym': t('A required debug symbol file was missing.'),
    'native_missing_system_dsym': t('A system debug symbol file was missing.'),
    'native_missing_symbol': t('Unable to resolve a symbol.'),
    'native_simulator_frame': t('Encountered an unprocessable simulator frame.'),
    'native_unknown_image': t('An binary image is referenced that is unknown.')
};

const HELP_LINKS = {
  'native_missing_dsym': 'https://docs.sentry.io/clients/cocoa/dsym/',
  'native_bad_dsym': 'https://docs.sentry.io/clients/cocoa/dsym/',
  'native_missing_system_dsym': 'https://docs.sentry.io/server/dsym/',
  'native_missing_symbol': 'https://docs.sentry.io/server/dsym/',
};


const ProjectProcessingIssues = React.createClass({
  mixins: [ApiMixin],

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

  onFieldChange(name) {
    let formData = this.state.formData;
    formData[name] = !this.state.formData['sentry:reprocessing_active'];
    this.setState({
      formData: formData,
    });
    this.switchReporcessing();
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.setState({
      expected: (this.state.expected + 2),
    });
    this.api.request(`/projects/${orgId}/${projectId}/`, {
      success: (data, _, jqXHR) => {
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          loading: expected > 0,
          formData: data.options,
        });
      },
      error: () => {
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          error: true,
          loading: expected > 0
        });
      }
    });

    this.api.request(`/projects/${orgId}/${projectId}/processingissues/?detailed=1`, {
      success: (data, _, jqXHR) => {
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          error: false,
          loading: expected > 0,
          processingIssues: data,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: () => {
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          error: true,
          loading: expected > 0
        });
      }
    });
  },

  sendReprocessing() {
    this.setState({
      reprocessing: true
    });
    let loadingIndicator = IndicatorStore.add(t('Started reprocessing..'));
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/reprocessing/`, {
      method: 'POST',
      success: (data, _, jqXHR) => {
        this.fetchData();
        this.setState({
          reprocessing: false
        });
      },
      error: () => {
        this.setState({
          reprocessing: false
        });
      }, complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  deleteProcessingIssues() {
    let {orgId, projectId} = this.props.params;
    this.setState({
      expected: (this.state.expected + 1),
    });
    this.api.request(`/projects/${orgId}/${projectId}/processingissues/?detailed=1`, {
      method: 'DELETE',
      success: (data, _, jqXHR) => {
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          error: false,
          loading: expected > 0,
        });
        // we reload to get rid of the badge in the sidebar
        window.location.reload();
      },
      error: () => {
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          error: true,
          loading: expected > 0
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
    let msg = MESSAGES[item.type];
    return msg || item.message || 'Unknown Error';
  },

  getImageName(path) {
    let pathSegments = path.split(/\//g);
    return pathSegments[pathSegments.length - 1];
  },

  renderProblem(item) {
    let description = this.getProblemDescription(item);
    let helpLink = HELP_LINKS[item.type];
    return (
      <div className="processing-issue">
        <span className="description">{description}</span>
        {' '}
        {helpLink &&
          <a href={helpLink} className="help-link"><span className="icon-question" /></a>}
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
    let fixButton = tn('Click here to trigger processing for %d pending event',
      'Click here to trigger processing for %d pending events',
      issues.resolveableIssues);
    return (
      <div className="alert alert-block alert-info">
        Pro Tip: <a onClick={this.sendReprocessing}>{fixButton}</a>
      </div>
    );
  },

  renderResults() {
    return (
      <table className="table processing-issues">
        <thead>
          <tr>
            <th>{t('Problem')}</th>
            <th>{t('Details')}</th>
            <th>{t('Events')}</th>
            <th>{t('Last seen')}</th>
          </tr>
        </thead>
        <tbody>
          {this.state.processingIssues.issues.map((item, idx) => {
            return (
              <tr key={idx}>
                <td>{this.renderProblem(item)}</td>
                <td>{this.renderDetails(item)}</td>
                <td>{item.numEvents + ''}</td>
                <td><TimeSince date={item.lastSeen}/></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  },

  renderReprocessingSettings() {
    if (this.state.loading) {
      return this.renderLoading();
    }
    let isSaving = this.state.formState === FormState.SAVING;
    let errors = this.state.errors;
    return (
      <div className="box">
        <div className="box-header">
          <h3>{t('Settings')}</h3>
        </div>
        <div className="box-content with-padding">
          <div className="row">
            {this.state.state === FormState.ERROR &&
              <div className="alert alert-error alert-block">
                {t('Unable to save your changes. Please ensure all fields are valid and try again.')}
              </div>
            }
            <div className="col-md-9" style={{marginBottom: 20}}>
              <h5 style={{marginBottom: 10}}>Reprocessing active</h5>
              {t(`If reprocessing is enabled, Events with fixable issues will be
                held back until you resolve them. Processing issues will then
                show up in the list above with hints how to fix them.
                If reprocessing is disabled Events with unresolved issues will also
                show up in the stream.
                `)}
            </div>
            <div className="col-md-3 align-right" style={{paddingRight: '25px'}}>
              <Switch size="lg"
                isActive={this.state.formData['sentry:reprocessing_active']}
                isLoading={this.state.formState === FormState.SAVING}
                toggle={this.onFieldChange.bind(this, 'sentry:reprocessing_active')} />
            </div>
          </div>
        </div>
      </div>
    );
  },

  switchReporcessing() {
    if (this.state.formState === FormState.SAVING) {
      return;
    }
    this.setState({
      state: FormState.SAVING,
    }, () => {
      let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
      let {orgId, projectId} = this.props.params;
      this.api.request(`/projects/${orgId}/${projectId}/`, {
        method: 'PUT',
        data: {options: this.state.formData},
        success: (data) => {
          this.setState({
            state: FormState.READY,
            errors: {},
          });
          this.deleteProcessingIssues();
        },
        error: (error) => {
          this.setState({
            state: FormState.ERROR,
            errors: error.responseJSON,
          });
        },
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
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
        {this.renderResolveButton()}
        {this.renderReprocessingSettings()}
      </div>
    );
  }
});

export default ProjectProcessingIssues;
