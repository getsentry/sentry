import {browserHistory} from 'react-router';
import {isEqual} from 'lodash';
import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import idx from 'idx';

import {
  BooleanField,
  FormState,
  NumberField,
  Select2Field,
  TextField,
} from '../components/forms';
import {t, tct} from '../locale';
import ApiMixin from '../mixins/apiMixin';
import AutoSelectText from '../components/autoSelectText';
import DateTime from '../components/dateTime';
import DynamicWrapper from '../components/dynamicWrapper';
import FlowLayout from '../components/flowLayout';
import HookStore from '../stores/hookStore';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import ProjectState from '../mixins/projectState';
import StackedBarChart from '../components/stackedBarChart';

// Exporting this only so we can quickly and simply unit test it
// Not moving this to utils because this is tightly coupled to the UI
export const getRateLimitError = (obj, key) => {
  if (!obj || !obj.rateLimit || !Array.isArray(obj.rateLimit)) return null;

  return !!obj.rateLimit.find(errorObj => errorObj[key] && errorObj[key].length);
};

const KeyStats = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    let until = Math.floor(new Date().getTime() / 1000);
    let since = until - 3600 * 24 * 30;

    return {
      since,
      until,
      loading: true,
      error: false,
      stats: null,
      emptyStats: false,
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    let {keyId, orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/keys/${keyId}/stats/`, {
      query: {
        since: this.state.since,
        until: this.state.until,
        resolution: '1d',
      },
      success: data => {
        let emptyStats = true;
        let stats = data.map(p => {
          if (p.total) emptyStats = false;
          return {
            x: p.ts,
            y: [p.accepted, p.dropped],
          };
        });
        this.setState({
          stats,
          emptyStats,
          error: false,
          loading: false,
        });
      },
      error: () => {
        this.setState({error: true, loading: false});
      },
    });
  },

  renderTooltip(point, pointIdx, chart) {
    let timeLabel = chart.getTimeLabel(point);
    let [accepted, dropped, filtered] = point.y;

    let value = `${accepted.toLocaleString()} accepted`;
    if (dropped) {
      value += `<br>${dropped.toLocaleString()} rate limited`;
    }
    if (filtered) {
      value += `<br>${filtered.toLocaleString()} filtered`;
    }

    return (
      '<div style="width:150px">' +
      `<div class="time-label">${timeLabel}</div>` +
      `<div class="value-label">${value}</div>` +
      '</div>'
    );
  },

  render() {
    if (this.state.loading)
      return (
        <div className="box">
          <LoadingIndicator />
        </div>
      );
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    return (
      <div className="box">
        <div className="box-header">
          <h5>{t('Key usage in the last 30 days (by day)')}</h5>
        </div>
        {!this.state.emptyStats ? (
          <StackedBarChart
            points={this.state.stats}
            height={150}
            label="events"
            barClasses={['accepted', 'rate-limited']}
            className="standard-barchart"
            tooltip={this.renderTooltip}
          />
        ) : (
          <div className="box-content">
            <div className="blankslate p-y-2">
              <h5>{t('Nothing recorded in the last 30 days.')}</h5>
              <p className="m-b-0">
                {t('Total events captured using these credentials.')}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  },
});

const KeySettings = React.createClass({
  propTypes: {
    organization: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    access: PropTypes.object.isRequired,
    data: PropTypes.object.isRequired,
    initialData: PropTypes.object,
    onRemove: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    rateLimitsEnabled: PropTypes.bool,
  },

  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    return {
      formData: Object.assign({}, this.props.initialData),
      errors: {},
      hooksDisabled: HookStore.get('project:rate-limits:disabled'),
    };
  },

  onFieldChange(name, value) {
    this.setState(state => {
      return {
        formData: {
          ...state.formData,
          [name]: value,
        },
      };
    });
  },

  onRateLimitChange(name, value) {
    this.setState(state => {
      return {
        formData: {
          ...state.formData,
          rateLimit: {
            ...(state.formData.rateLimit || {}),
            [name]: value,
          },
        },
      };
    });
  },

  onSubmit(e) {
    e.preventDefault();

    if (this.state.state == FormState.SAVING) {
      return;
    }
    this.setState(
      {
        state: FormState.SAVING,
      },
      () => {
        let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
        let {keyId, orgId, projectId} = this.props.params;
        this.api.request(`/projects/${orgId}/${projectId}/keys/${keyId}/`, {
          method: 'PUT',
          data: this.state.formData,
          success: data => {
            this.props.onSave(data);
            this.setState({
              state: FormState.READY,
              errors: {},
            });
          },
          error: error => {
            this.setState({
              state: FormState.ERROR,
              errors: error.responseJSON,
            });
          },
          complete: () => {
            IndicatorStore.remove(loadingIndicator);
          },
        });
      }
    );
  },

  onRemove(e) {
    e.preventDefault();
    if (this.state.loading) return;

    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {keyId, orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/keys/${keyId}/`, {
      method: 'DELETE',
      success: (d, _, jqXHR) => {
        this.props.onRemove();
        IndicatorStore.remove(loadingIndicator);
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
        IndicatorStore.remove(loadingIndicator);
      },
    });
  },

  getRateLimitWindows() {
    return [
      ['', ''],
      [60, '1 minute'],
      [300, '5 minutes'],
      [900, '15 minutes'],
      [3600, '1 hour'],
      [7200, '2 hours'],
      [14400, '4 hours'],
      [21600, '6 hours'],
      [43200, '12 hours'],
      [86400, '24 hours'],
    ];
  },

  render() {
    let features = this.getProjectFeatures();
    let isSaving = this.state.state === FormState.SAVING;
    let {errors, formData} = this.state;
    let hasChanges = !isEqual(this.props.initialData, formData);
    let {access, data, rateLimitsEnabled, organization, project} = this.props;
    let rateLimitWindowError = getRateLimitError(errors, 'window');
    let rateLimitCountError = getRateLimitError(errors, 'count');

    return (
      <form onSubmit={this.onSubmit} className="form-stacked">
        {this.state.state === FormState.ERROR && (
          <div className="alert alert-error alert-block">
            {t(
              'Unable to save your changes. Please ensure all fields are valid and try again.'
            )}
          </div>
        )}
        <div className="box">
          <div className="box-header">
            <h3>{t('Details')}</h3>
          </div>
          <div className="box-content with-padding">
            <TextField
              key="name"
              name="name"
              label={t('Name')}
              value={formData.name}
              required={false}
              error={errors.name}
              onChange={this.onFieldChange.bind(this, 'name')}
            />

            <BooleanField
              key="isActive"
              name="isActive"
              label={t('Enabled')}
              value={formData.isActive}
              required={false}
              error={errors.isActive}
              help={
                'Accept events from this key? This may be used to temporarily suspend a key.'
              }
              onChange={this.onFieldChange.bind(this, 'isActive')}
            />

            <div className="form-group">
              <label>{t('Created')}</label>
              <div className="controls">
                <DateTime date={data.dateCreated} />
              </div>
            </div>

            <fieldset className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving || !hasChanges}
              >
                {t('Save Changes')}
              </button>
            </fieldset>
          </div>
        </div>

        {!rateLimitsEnabled ? (
          this.state.hooksDisabled
            .map(hook => {
              return hook(organization, project, data);
            })
            .shift()
        ) : (
          <div className="box">
            <div className="box-header">
              <h3>{t('Rate Limits')}</h3>
            </div>
            <div className="box-content with-padding">
              <p>
                {
                  'Rate limits provide a flexible way to manage your event volume. If you have a noisy project or environment you can configure a rate limit for this key to reduce the number of events processed.'
                }
              </p>
              <div className="form-group rate-limit-group">
                <label>{t('Rate Limit')}</label>
                <FlowLayout truncate={false}>
                  <div style={{width: 80}}>
                    <NumberField
                      hideErrorMessage
                      key="rateLimit.count"
                      name="rateLimit.count"
                      min={0}
                      value={idx(formData, _ => _.rateLimit.count)}
                      required={false}
                      error={rateLimitCountError}
                      placeholder={t('count')}
                      onChange={this.onRateLimitChange.bind(this, 'count')}
                      className=""
                    />
                  </div>
                  <div style={{margin: '0 10px'}}>
                    <small>event(s) in</small>
                  </div>
                  <div style={{width: 150}}>
                    <Select2Field
                      width="100%"
                      hideErrorMessage
                      key="rateLimit.window"
                      name="rateLimit.window"
                      choices={this.getRateLimitWindows()}
                      value={idx(formData, _ => _.rateLimit.window)}
                      required={false}
                      error={rateLimitWindowError}
                      placeholder={t('window')}
                      allowClear={true}
                      onChange={this.onRateLimitChange.bind(this, 'window')}
                      className=""
                    />
                  </div>
                </FlowLayout>

                <div className="help-block">
                  {t(
                    'Apply a rate limit to this credential to cap the amount of events accepted during a time window.'
                  )}
                </div>
              </div>
              <fieldset className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving || !hasChanges}
                >
                  {t('Save Changes')}
                </button>
              </fieldset>
            </div>
          </div>
        )}
        <div className="box dsn-credentials">
          <div className="box-header">
            <h3>{t('Credentials')}</h3>
          </div>
          <div className="box-content with-padding">
            <p>
              {t(
                'Your credentials are coupled to a public and secret key. Different clients will require different credentials, so make sure you check the documentation before plugging things in.'
              )}
            </p>
            <div className="form-group">
              <label>{t('DSN')}</label>
              <AutoSelectText className="form-control disabled">
                <DynamicWrapper
                  value={data.dsn.secret}
                  fixed={data.dsn.secret.replace(data.projectId, '<<projectId>>')}
                />
              </AutoSelectText>
            </div>

            <div className="form-group">
              <label>{t('DSN (Public)')}</label>
              <AutoSelectText className="form-control disabled">
                <DynamicWrapper
                  value={data.dsn.public}
                  fixed={data.dsn.public.replace(data.projectId, '<<projectId>>')}
                />
              </AutoSelectText>
              <div className="help-block">
                {tct('Use your public DSN with browser-based SDKs such as [raven-js].', {
                  'raven-js': (
                    <a href="https://github.com/getsentry/raven-js">raven-js</a>
                  ),
                })}
              </div>
            </div>
            <div className="form-group">
              <label>{t('CSP Endpoint')}</label>
              <AutoSelectText className="form-control disabled">
                <DynamicWrapper
                  value={data.dsn.csp}
                  fixed={data.dsn.csp.replace(data.projectId, '<<projectId>>')}
                />
              </AutoSelectText>
              <div className="help-block">
                {tct(
                  'Use your CSP endpoint in the [directive] directive in your [header] header.',
                  {
                    directive: <code>report-uri</code>,
                    header: <code>Content-Security-Policy</code>,
                  }
                )}
              </div>
            </div>
            {features.has('minidump') && (
              <div className="form-group">
                <label>{t('Minidump Endpoint')}</label>
                <AutoSelectText className="form-control disabled">
                  {data.dsn.minidump}
                </AutoSelectText>
                <div className="help-block">
                  {tct(
                    'Use this endpoint to upload minidump crash reports, for example with Electron, Crashpad or Breakpad.',
                    {
                      /* TODO: add a link to minidump docs */
                    }
                  )}
                </div>
              </div>
            )}
            <div className="form-group">
              <label>{t('Public Key')}</label>
              <div className="controls">
                <AutoSelectText className="form-control disabled">
                  {data.public}
                </AutoSelectText>
              </div>
            </div>
            <div className="form-group">
              <label>{t('Secret Key')}</label>
              <div className="controls">
                <AutoSelectText className="form-control disabled">
                  {data.secret}
                </AutoSelectText>
              </div>
            </div>
            <div className="form-group">
              <label>{t('Project ID')}</label>
              <div className="controls">
                <AutoSelectText className="form-control disabled">
                  <DynamicWrapper value={data.projectId} fixed="<<projectId>>" />
                </AutoSelectText>
              </div>
            </div>
          </div>
        </div>

        {access.has('project:admin') && (
          <div className="box">
            <div className="box-header">
              <h3>{t('Revoke Key')}</h3>
            </div>
            <div className="box-content with-padding">
              <p>
                {t(
                  'Revoking this key will immediately remove and suspend the credentials. This action is irreversible.'
                )}
              </p>

              <fieldset className="form-actions">
                <a onClick={this.onRemove} className="btn btn-danger">
                  {t('Revoke Key')}
                </a>
              </fieldset>
            </div>
          </div>
        )}
      </form>
    );
  },
});

export default React.createClass({
  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      data: null,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {keyId, orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/keys/${keyId}/`, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          data,
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

  handleRemove(data) {
    let {orgId, projectId} = this.props.params;
    browserHistory.push(`/${orgId}/${projectId}/settings/keys/`);
  },

  handleSave(data) {
    this.setState({data: {...this.state.data, ...data}});
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  render() {
    if (this.state.loading) return this.renderLoading();
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    let {data} = this.state;
    let {params} = this.props;

    return (
      <DocumentTitle title={t('Key Details')}>
        <div className="ref-key-details">
          <h2>{t('Key Details')}</h2>

          <KeyStats params={params} />

          <KeySettings
            organization={this.getOrganization()}
            project={this.getProject()}
            access={this.getAccess()}
            params={params}
            initialData={{
              isActive: data.isActive,
              name: data.name,
              rateLimit: data.rateLimit,
            }}
            rateLimitsEnabled={this.getProjectFeatures().has('rate-limits')}
            data={data}
            onSave={this.handleSave}
            onRemove={this.handleRemove}
          />
        </div>
      </DocumentTitle>
    );
  },
});
