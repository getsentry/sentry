import PropTypes from 'prop-types';
import React from 'react';

import {Panel, PanelItem, PanelBody, PanelAlert} from 'app/components/panels';
import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {t, tn} from 'app/locale';
import Access from 'app/components/acl/access';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import AutoSelectText from 'app/components/autoSelectText';
import Button from 'app/components/button';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import TimeSince from 'app/components/timeSince';
import formGroups from 'app/data/forms/processingIssues';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

const MESSAGES = {
  native_no_crashed_thread: t('No crashed thread found in crash report'),
  native_internal_failure: t('Internal failure when attempting to symbolicate: {error}'),
  native_bad_dsym: t('The debug information file used was broken.'),
  native_missing_optionally_bundled_dsym: t(
    'An optional debug information file was missing.'
  ),
  native_missing_dsym: t('A required debug information file was missing.'),
  native_missing_system_dsym: t('A system debug information file was missing.'),
  native_missing_symbol: t(
    'Could not resolve one or more frames in debug information file.'
  ),
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

class ProjectProcessingIssues extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
  };

  state = {
    formData: {},
    loading: true,
    reprocessing: false,
    expected: 0,
    error: false,
    processingIssues: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  fetchData = () => {
    const {orgId, projectId} = this.props.params;
    this.setState({
      expected: this.state.expected + 2,
    });
    this.props.api.request(`/projects/${orgId}/${projectId}/`, {
      success: data => {
        const expected = this.state.expected - 1;
        this.setState({
          expected,
          loading: expected > 0,
          formData: data.options,
        });
      },
      error: () => {
        const expected = this.state.expected - 1;
        this.setState({
          expected,
          error: true,
          loading: expected > 0,
        });
      },
    });

    this.props.api.request(
      `/projects/${orgId}/${projectId}/processingissues/?detailed=1`,
      {
        success: (data, _, jqXHR) => {
          const expected = this.state.expected - 1;
          this.setState({
            expected,
            error: false,
            loading: expected > 0,
            processingIssues: data,
            pageLinks: jqXHR.getResponseHeader('Link'),
          });
        },
        error: () => {
          const expected = this.state.expected - 1;
          this.setState({
            expected,
            error: true,
            loading: expected > 0,
          });
        },
      }
    );
  };

  sendReprocessing = () => {
    this.setState({
      reprocessing: true,
    });
    addLoadingMessage(t('Started reprocessing..'));
    const {orgId, projectId} = this.props.params;
    this.props.api.request(`/projects/${orgId}/${projectId}/reprocessing/`, {
      method: 'POST',
      success: () => {
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
        clearIndicators();
      },
    });
  };

  discardEvents = () => {
    const {orgId, projectId} = this.props.params;
    this.setState({
      expected: this.state.expected + 1,
    });
    this.props.api.request(`/projects/${orgId}/${projectId}/processingissues/discard/`, {
      method: 'DELETE',
      success: () => {
        const expected = this.state.expected - 1;
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
        const expected = this.state.expected - 1;
        this.setState({
          expected,
          error: true,
          loading: expected > 0,
        });
      },
    });
  };

  deleteProcessingIssues = () => {
    const {orgId, projectId} = this.props.params;
    this.setState({
      expected: this.state.expected + 1,
    });
    this.props.api.request(`/projects/${orgId}/${projectId}/processingissues/`, {
      method: 'DELETE',
      success: () => {
        const expected = this.state.expected - 1;
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
        const expected = this.state.expected - 1;
        this.setState({
          expected,
          error: true,
          loading: expected > 0,
        });
      },
    });
  };

  renderDebugTable = () => {
    let body;
    if (this.state.loading) {
      body = this.renderLoading();
    } else if (this.state.error) {
      body = <LoadingError onRetry={this.fetchData} />;
    } else if (
      this.state.processingIssues.hasIssues ||
      this.state.processingIssues.resolveableIssues ||
      this.state.processingIssues.issuesProcessing
    ) {
      body = this.renderResults();
    } else {
      body = this.renderEmpty();
    }

    return body;
  };

  renderLoading = () => (
    <div className="box">
      <LoadingIndicator />
    </div>
  );

  renderEmpty = () => (
    <Panel>
      <EmptyStateWarning>
        <p>{t('Good news! There are no processing issues.')}</p>
      </EmptyStateWarning>
    </Panel>
  );

  getProblemDescription = item => {
    const msg = MESSAGES[item.type];
    return msg || item.message || 'Unknown Error';
  };

  getImageName = path => {
    const pathSegments = path.split(/^([a-z]:\\|\\\\)/i.test(path) ? '\\' : '/');
    return pathSegments[pathSegments.length - 1];
  };

  renderProblem = item => {
    const description = this.getProblemDescription(item);
    const helpLink = HELP_LINKS[item.type];
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
  };

  renderDetails = item => {
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
  };

  renderResolveButton = () => {
    const issues = this.state.processingIssues;
    if (issues === null || this.state.reprocessing) {
      return null;
    }
    if (issues.resolveableIssues <= 0) {
      return null;
    }
    const fixButton = tn(
      'Click here to trigger processing for %s pending event',
      'Click here to trigger processing for %s pending events',
      issues.resolveableIssues
    );
    return (
      <div className="alert alert-block alert-info">
        Pro Tip: <a onClick={this.sendReprocessing}>{fixButton}</a>
      </div>
    );
  };

  renderResults = () => {
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
              <AutoSelectText className="form-control disabled" style={{marginBottom: 6}}>
                curl -sL "{fixLink}" | bash
              </AutoSelectText>
            </div>
          </div>
        </div>
      );
    }
    let processingRow = null;
    if (this.state.processingIssues.issuesProcessing > 0) {
      processingRow = (
        <PanelItem className="alert-info">
          <div className="row row-flex row-center-vertically">
            <div className="col-sm-12">
              <span
                className="icon icon-processing play"
                style={{display: 'inline', marginRight: 12}}
              />
              {tn(
                'Reprocessing %s event …',
                'Reprocessing %s events …',
                this.state.processingIssues.issuesProcessing
              )}
            </div>
          </div>
        </PanelItem>
      );
    }

    return (
      <div>
        {fixLinkBlock}
        <h3>
          {t('Pending Issues')}
          <Access access={['project:write']}>
            {({hasAccess}) => (
              <Button
                size="small"
                className="pull-right"
                disabled={!hasAccess}
                onClick={() => this.discardEvents()}
              >
                {t('Discard all')}
              </Button>
            )}
          </Access>
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
          <PanelBody>
            {processingRow}
            {this.state.processingIssues.issues.map((item, idx) => (
              <PanelItem key={idx}>
                <div className="row row-flex row-center-vertically">
                  <div className="col-sm-3">{this.renderProblem(item)}</div>
                  <div className="col-sm-5">{this.renderDetails(item)}</div>
                  <div className="col-sm-2">{item.numEvents + ''}</div>
                  <div className="col-sm-2">
                    <TimeSince date={item.lastSeen} />
                  </div>
                </div>
              </PanelItem>
            ))}
          </PanelBody>
        </div>
      </div>
    );
  };

  renderReprocessingSettings = () => {
    const access = new Set(this.props.organization.access);
    if (this.state.loading) {
      return this.renderLoading();
    }

    const {formData} = this.state;
    const {orgId, projectId} = this.props.params;
    return (
      <Form
        saveOnBlur
        onSubmitSuccess={this.deleteProcessingIssues}
        apiEndpoint={`/projects/${orgId}/${projectId}/`}
        apiMethod="PUT"
        initialData={formData}
      >
        <JsonForm
          access={access}
          forms={formGroups}
          renderHeader={() => (
            <PanelAlert type="warning">
              <TextBlock noMargin>
                {t(`Reprocessing does not apply to Minidumps. Even when enabled,
                    Minidump events with processing issues will show up in the
                    issues stream immediately and cannot be reprocessed.`)}
              </TextBlock>
            </PanelAlert>
          )}
        />
      </Form>
    );
  };

  render() {
    const {projectId} = this.props.params;
    const title = t('Processing Issues');
    return (
      <div>
        <SentryDocumentTitle title={title} objSlug={projectId} />
        <SettingsPageHeader title={title} />
        <TextBlock>
          {t(
            `For some platforms the event processing requires configuration or
          manual action.  If a misconfiguration happens or some necessary
          steps are skipped, issues can occur during processing. (The most common
          reason for this is missing debug symbols.) In these cases you can see
          all the problems here with guides of how to correct them.`
          )}
        </TextBlock>
        {this.renderDebugTable()}
        {this.renderResolveButton()}
        {this.renderReprocessingSettings()}
      </div>
    );
  }
}

export {ProjectProcessingIssues};

export default withApi(withOrganization(ProjectProcessingIssues));
