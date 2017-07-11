import React from 'react';
import DocumentTitle from 'react-document-title';
import {isEqual} from 'lodash';
import {browserHistory} from 'react-router';
import idx from 'idx';

import ApiMixin from '../mixins/apiMixin';
import AutoSelectText from '../components/autoSelectText';
import DateTime from '../components/dateTime';
import HookStore from '../stores/hookStore';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import ProjectState from '../mixins/projectState';
import StackedBarChart from '../components/stackedBarChart';
import {
  BooleanField,
  FormState,
  NumberField,
  Select2Field,
  TextField
} from '../components/forms';
import {t, tct} from '../locale';

const KeyStats = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    let until = Math.floor(new Date().getTime() / 1000);
    let since = until - 3600 * 24 * 30;

    return {
      since: since,
      until: until,
      loading: true,
      error: false,
      stats: null,
      emptyStats: false
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
        resolution: '1d'
      },
      success: data => {
        let emptyStats = true;
        let stats = data.map(p => {
          if (p.total) emptyStats = false;
          return {
            x: p.ts,
            y: [p.accepted, p.dropped]
          };
        });
        this.setState({
          stats: stats,
          emptyStats: emptyStats,
          error: false,
          loading: false
        });
      },
      error: () => {
        this.setState({error: true, loading: false});
      }
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
    if (this.state.loading) return <div className="box"><LoadingIndicator /></div>;
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    return (
      <div className="box">
        <div className="box-header">
          <h5>{t('Key usage in the last 30 days (by day)')}</h5>
        </div>
        {!this.state.emptyStats
          ? <StackedBarChart
              points={this.state.stats}
              height={150}
              label="events"
              barClasses={['accepted', 'rate-limited']}
              className="standard-barchart"
              tooltip={this.renderTooltip}
            />
          : <div className="box-content">
              <div className="blankslate p-y-2">
                <h5>{t('Nothing recorded in the last 30 days.')}</h5>
                <p className="m-b-0">
                  {t('Total events captured using these credentials.')}
                </p>
              </div>
            </div>}
      </div>
    );
  }
});

const KeySettings = React.createClass({
  propTypes: {
    organization: React.PropTypes.object.isRequired,
    project: React.PropTypes.object.isRequired,
    access: React.PropTypes.object.isRequired,
    data: React.PropTypes.object.isRequired,
    initialData: React.PropTypes.object,
    onRemove: React.PropTypes.func.isRequired,
    onSave: React.PropTypes.func.isRequired,
    rateLimitsEnabled: React.PropTypes.bool
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      formData: Object.assign({}, this.props.initialData),
      errors: {},
      hooksDisabled: HookStore.get('project:rate-limits:disabled')
    };
  },

  onFieldChange(name, value) {
    this.setState(state => {
      return {
        formData: {
          ...state.formData,
          [name]: value
        }
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
            [name]: value
          }
        }
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
        state: FormState.SAVING
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
              errors: {}
            });
          },
          error: error => {
            this.setState({
              state: FormState.ERROR,
              errors: error.responseJSON
            });
          },
          complete: () => {
            IndicatorStore.remove(loadingIndicator);
          }
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
          loading: false
        });
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  getRateLimitWindows() {
    return [
      ['', ''],
      [1, '1 minute'],
      [5, '5 minutes'],
      [15, '15 minutes'],
      [60, '1 hour'],
      [120, '2 hours'],
      [240, '4 hours'],
      [360, '6 hours'],
      [720, '12 hours'],
      [1440, '24 hours']
    ];
  },

  render() {
    let isSaving = this.state.state === FormState.SAVING;
    let {errors, formData} = this.state;
    let hasChanges = !isEqual(this.props.initialData, formData);
    let {access, data, rateLimitsEnabled, organization, project} = this.props;
    return (
      <form onSubmit={this.onSubmit} className="form-stacked">
        {this.state.state === FormState.ERROR &&
          <div className="alert alert-error alert-block">
            {t(
              'Unable to save your changes. Please ensure all fields are valid and try again.'
            )}
          </div>}
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
                disabled={isSaving || !hasChanges}>
                {t('Save Changes')}
              </button>
            </fieldset>
          </div>
        </div>

        {!rateLimitsEnabled
          ? this.state.hooksDisabled
              .map(hook => {
                return hook(organization, project, data);
              })
              .shift()
          : <div className="box">
              <div className="box-header">
                <h3>{t('Rate Limits')}</h3>
              </div>
              <div className="box-content with-padding">
                <p>
                  {
                    'Rate limits provide a flexible way to manage your event volume. If you have a noisy project or environment you can configure a rate limit for this key to reduce the number of events processed.'
                  }
                </p>
                <div className="form-group">
                  <label>{t('Rate Limit')}</label>
                  <div>
                    <div style={{width: 80, display: 'inline-block'}}>
                      <NumberField
                        key="rateLimit.count"
                        name="rateLimit.count"
                        min={0}
                        value={idx(formData, _ => _.rateLimit.count)}
                        required={false}
                        error={errors.rateLimit}
                        placeholder={t('count')}
                        onChange={this.onRateLimitChange.bind(this, 'count')}
                        className=""
                      />
                    </div>
                    <div style={{display: 'inline-block', margin: '0 10px'}}>
                      <small>event(s) in</small>
                    </div>
                    <div style={{width: 150, display: 'inline-block'}}>
                      <Select2Field
                        width="100%"
                        key="rateLimit.window"
                        name="rateLimit.window"
                        choices={this.getRateLimitWindows()}
                        value={idx(formData, _ => _.rateLimit.window)}
                        required={false}
                        error={errors.rateLimit}
                        placeholder={t('window')}
                        allowClear={true}
                        onChange={this.onRateLimitChange.bind(this, 'window')}
                        className=""
                      />
                    </div>
                    <div className="help-block">
                      {t(
                        'Apply a rate limit to this credential to cap the amount of events accepted during a time window.'
                      )}
                    </div>
                  </div>
                </div>
                <fieldset className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSaving || !hasChanges}>
                    {t('Save Changes')}
                  </button>
                </fieldset>
              </div>
            </div>}
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
                {data.dsn.secret}
              </AutoSelectText>
            </div>

            <div className="form-group">
              <label>{t('DSN (Public)')}</label>
              <AutoSelectText className="form-control disabled">
                {data.dsn.public}
              </AutoSelectText>
              <div className="help-block">
                {tct('Use your public DSN with browser-based SDKs such as [raven-js].', {
                  'raven-js': <a href="https://github.com/getsentry/raven-js">raven-js</a>
                })}
              </div>
            </div>
            <div className="form-group">
              <label>{t('CSP Endpoint')}</label>
              <AutoSelectText className="form-control disabled">
                {data.dsn.csp}
              </AutoSelectText>
              <div className="help-block">
                {tct(
                  'Use your CSP endpoint in the [directive] directive in your [header] header.',
                  {
                    directive: <code>report-uri</code>,
                    header: <code>Content-Security-Policy</code>
                  }
                )}
              </div>
            </div>
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
                  {data.projectId}
                </AutoSelectText>
              </div>
            </div>
          </div>
        </div>

        {access.has('project:admin') &&
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
          </div>}
      </form>
    );
  }
});

export default React.createClass({
  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      data: null
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
          data: data
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

  handleRemove(data) {
    let {orgId, projectId} = this.props.params;
    browserHistory.pushState(null, `/${orgId}/${projectId}/settings/keys/`);
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
              rateLimit: data.rateLimit
            }}
            rateLimitsEnabled={this.getProjectFeatures().has('rate-limits')}
            data={data}
            onSave={this.handleSave}
            onRemove={this.handleRemove}
          />
        </div>
      </DocumentTitle>
    );
  }
});
