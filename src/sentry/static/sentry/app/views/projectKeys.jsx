import {Link} from 'react-router';
import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

import {t, tct} from '../locale';
import ApiMixin from '../mixins/apiMixin';
import AutoSelectText from '../components/autoSelectText';
import ClippedBox from '../components/clippedBox';
import Confirm from '../components/confirm';
import DynamicWrapper from '../components/dynamicWrapper';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import OrganizationState from '../mixins/organizationState';
import Pagination from '../components/pagination';
import ProjectState from '../mixins/projectState';

const KeyRow = createReactClass({
  displayName: 'KeyRow',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    access: PropTypes.object.isRequired,
    onToggle: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    return {
      loading: false,
      error: false,
    };
  },

  handleRemove() {
    if (this.state.loading) return;

    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {orgId, projectId, data} = this.props;
    this.api.request(`/projects/${orgId}/${projectId}/keys/${data.id}/`, {
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

  handleUpdate(params, cb) {
    if (this.state.loading) return;
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {orgId, projectId, data} = this.props;
    this.api.request(`/projects/${orgId}/${projectId}/keys/${data.id}/`, {
      method: 'PUT',
      data: params,
      success: (d, _, jqXHR) => {
        IndicatorStore.remove(loadingIndicator);
        cb(d);
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

  handleEnable() {
    this.handleUpdate(
      {
        isActive: true,
      },
      this.props.onToggle
    );
  },

  handleDisable() {
    this.handleUpdate(
      {
        isActive: false,
      },
      this.props.onToggle
    );
  },

  render() {
    let features = this.getProjectFeatures();
    let {access, data, orgId, projectId} = this.props;
    let editUrl = `/${orgId}/${projectId}/settings/keys/${data.id}/`;
    let controls = [
      <Link key="edit" to={editUrl} className="btn btn-default btn-sm">
        {t('Details')}
      </Link>,
    ];
    if (access.has('project:write')) {
      controls.push(
        <a
          key="toggle"
          className="btn btn-default btn-sm"
          onClick={data.isActive ? this.handleDisable : this.handleEnable}
          disabled={this.state.loading}
        >
          {data.isActive ? t('Disable') : t('Enable')}
        </a>
      );
      controls.push(
        <Confirm
          key="remove"
          priority="danger"
          disabled={this.state.loading}
          onConfirm={this.handleRemove}
          confirmText={t('Remove Key')}
          message={t(
            'Are you sure you want to remove this key? This action is irreversible.'
          )}
        >
          <a className="btn btn-sm btn-default" disabled={this.state.loading}>
            <span className="icon icon-trash" />
          </a>
        </Confirm>
      );
    }

    return (
      <div className={`client-key-item ${!data.isActive ? 'disabled' : ''}`}>
        <div className="pull-right" style={{marginTop: -10}}>
          {controls.map((c, n) => <span key={n}> {c}</span>)}
        </div>
        <h5>
          <Link to={editUrl}>{data.label}</Link>
          {!data.isActive && (
            <small>
              {' '}
              <i className="icon icon-ban" /> {t('Disabled')}
            </small>
          )}
        </h5>

        <ClippedBox
          clipHeight={150}
          defaultClipped={true}
          btnClassName="btn btn-default btn-sm"
          btnText={t('Expand')}
        >
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
                'raven-js': <a href="https://github.com/getsentry/raven-js">raven-js</a>,
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
        </ClippedBox>
      </div>
    );
  },
});

export default createReactClass({
  displayName: 'projectKeys',
  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      keyList: [],
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/keys/`, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          keyList: data,
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

  handleRemoveKey(data) {
    this.setState(state => {
      return {
        keyList: state.keyList.filter(key => {
          return key.id !== data.id;
        }),
      };
    });
  },

  handleToggleKey(data, newData) {
    this.setState(state => {
      let keyList = state.keyList;
      keyList.forEach(key => {
        if (key.id === data.id) {
          key.isActive = newData.isActive;
        }
      });
      return {keyList};
    });
  },

  onCreateKey() {
    let {orgId, projectId} = this.props.params;
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(`/projects/${orgId}/${projectId}/keys/`, {
      method: 'POST',
      success: (data, _, jqXHR) => {
        this.setState(state => {
          return {
            keyList: [...state.keyList, data],
          };
        });
        IndicatorStore.remove(loadingIndicator);
      },
      error: () => {
        IndicatorStore.remove(loadingIndicator);
        IndicatorStore.add(t('Unable to create new key. Please try again.'), 'error');
      },
    });
  },

  renderBody() {
    let body;
    if (this.state.loading) body = this.renderLoading();
    else if (this.state.error) body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.keyList.length > 0) body = this.renderResults();
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
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('There are no keys active for this project.')}</p>
      </div>
    );
  },

  renderResults() {
    let {orgId, projectId} = this.props.params;
    let access = this.getAccess();
    return (
      <div>
        <div className="client-key-list">
          {this.state.keyList.map(key => {
            return (
              <KeyRow
                access={access}
                key={key.id}
                orgId={orgId}
                projectId={projectId}
                data={key}
                onToggle={this.handleToggleKey.bind(this, key)}
                onRemove={this.handleRemoveKey.bind(this, key)}
              />
            );
          })}
        </div>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  },

  render() {
    let access = this.getAccess();
    return (
      <DocumentTitle title={t('Client Keys')}>
        <div className="ref-keys">
          {access.has('project:write') && (
            <a onClick={this.onCreateKey} className="btn pull-right btn-primary btn-sm">
              <span className="icon-plus" />&nbsp;{t('Generate New Key')}
            </a>
          )}
          <h2>{t('Client Keys')}</h2>
          <p>
            To send data to Sentry you will need to configure an SDK with a client key
            (usually referred to as the <code>SENTRY_DSN</code> value). For more
            information on integrating Sentry with your application take a look at our{' '}
            <a href="https://docs.sentry.io/">documentation</a>
            .
          </p>
          {this.renderBody()}
        </div>
      </DocumentTitle>
    );
  },
});
