import {Box, Flex} from 'grid-emotion';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  removeIndicator,
} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import Access from 'app/components/acl/access';
import ApiMixin from 'app/mixins/apiMixin';
import AsyncView from 'app/views/asyncView';
import BooleanField from 'app/views/settings/components/forms/booleanField';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import DateTime from 'app/components/dateTime';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ExternalLink from 'app/components/externalLink';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import Field from 'app/views/settings/components/forms/field';
import Form from 'app/views/settings/components/forms/form';
import FormField from 'app/views/settings/components/forms/formField';
import InputControl from 'app/views/settings/components/forms/controls/input';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import ProjectKeyCredentials from 'app/views/settings/project/projectKeys/projectKeyCredentials';
import RangeSlider from 'app/views/settings/components/forms/controls/rangeSlider';
import SelectField from 'app/views/settings/components/forms/selectField';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import StackedBarChart from 'app/components/stackedBarChart';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import TextField from 'app/views/settings/components/forms/textField';
import getDynamicText from 'app/utils/getDynamicText';

const RATE_LIMIT_FORMAT_MAP = new Map([
  [0, 'None'],
  [60, '1 minute'],
  [300, '5 minutes'],
  [900, '15 minutes'],
  [3600, '1 hour'],
  [7200, '2 hours'],
  [14400, '4 hours'],
  [21600, '6 hours'],
  [43200, '12 hours'],
  [86400, '24 hours'],
]);

const formatRateLimitWindow = val => RATE_LIMIT_FORMAT_MAP.get(val);

const KeyStats = createReactClass({
  displayName: 'KeyStats',
  mixins: [ApiMixin],

  getInitialState() {
    const until = Math.floor(new Date().getTime() / 1000);
    const since = until - 3600 * 24 * 30;

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
    const {keyId, orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/keys/${keyId}/stats/`, {
      query: {
        since: this.state.since,
        until: this.state.until,
        resolution: '1d',
      },
      success: data => {
        let emptyStats = true;
        const stats = data.map(p => {
          if (p.total) {
            emptyStats = false;
          }
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
    const timeLabel = chart.getTimeLabel(point);
    const [accepted, dropped, filtered] = point.y;

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
    if (this.state.loading) {
      return (
        <div className="box">
          <LoadingIndicator />
        </div>
      );
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    return (
      <Panel>
        <PanelHeader>{t('Key usage in the last 30 days (by day)')}</PanelHeader>
        <PanelBody>
          {!this.state.emptyStats ? (
            <StackedBarChart
              points={this.state.stats}
              height={150}
              label="events"
              barClasses={['accepted', 'rate-limited']}
              className="standard-barchart"
              style={{border: 'none'}}
              tooltip={this.renderTooltip}
            />
          ) : (
            <EmptyMessage
              title={t('Nothing recorded in the last 30 days.')}
              description={t('Total events captured using these credentials.')}
            />
          )}
        </PanelBody>
      </Panel>
    );
  },
});

class KeyRateLimitsForm extends React.Component {
  static propTypes = {
    data: SentryTypes.ProjectKey.isRequired,
    disabled: PropTypes.bool,
  };

  handleChangeWindow = (onChange, onBlur, currentValueObj, value, e) => {
    const valueObj = {
      ...currentValueObj,
      window: value,
    };
    onChange(valueObj, e);
    onBlur(valueObj, e);
  };

  handleChangeCount = (cb, value, e) => {
    const valueObj = {
      ...value,
      count: e.target.value,
    };

    cb(valueObj, e);
  };

  render() {
    const {data, disabled} = this.props;
    const {keyId, orgId, projectId} = this.props.params;
    const apiEndpoint = `/projects/${orgId}/${projectId}/keys/${keyId}/`;

    const disabledAlert = ({features}) => (
      <FeatureDisabled
        alert={PanelAlert}
        features={features}
        featureName={t('Key Rate Limits')}
      />
    );

    return (
      <Form saveOnBlur apiEndpoint={apiEndpoint} apiMethod="PUT" initialData={data}>
        <Feature
          features={['projects:rate-limits']}
          renderDisabled={({children, ...props}) =>
            children({...props, renderDisabled: disabledAlert})}
        >
          {({hasFeature, features, organization, project, renderDisabled}) => (
            <Panel>
              <PanelHeader>{t('Rate Limits')}</PanelHeader>

              <PanelBody>
                <PanelAlert type="info" icon="icon-circle-exclamation">
                  {t(
                    `Rate limits provide a flexible way to manage your event
                      volume. If you have a noisy project or environment you
                      can configure a rate limit for this key to reduce the
                      number of events processed.`
                  )}
                </PanelAlert>
                {!hasFeature && renderDisabled({organization, project, features})}
                <FormField
                  className="rate-limit-group"
                  name="rateLimit"
                  label={t('Rate Limit')}
                  disabled={disabled || !hasFeature}
                  validate={({id, form, model}) => {
                    const isValid =
                      form &&
                      form.rateLimit &&
                      typeof form.rateLimit.count !== 'undefined' &&
                      typeof form.rateLimit.window !== 'undefined';

                    if (isValid) {
                      return [];
                    }

                    return [['rateLimit', t('Fill in both fields first')]];
                  }}
                  help={t(
                    'Apply a rate limit to this credential to cap the amount of events accepted during a time window.'
                  )}
                  inline={false}
                >
                  {({onChange, onBlur, value}) => (
                    <Flex>
                      <Flex flex="2" align="center">
                        <InputControl
                          type="number"
                          name="rateLimit.count"
                          min={0}
                          value={value && value.count}
                          placeholder={t('Count')}
                          disabled={disabled || !hasFeature}
                          onChange={this.handleChangeCount.bind(this, onChange, value)}
                          onBlur={this.handleChangeCount.bind(this, onBlur, value)}
                        />
                      </Flex>
                      <Flex justify="center" align="center" mx={10} flex="1">
                        <small css={{whiteSpace: 'nowrap'}}>event(s) in</small>
                      </Flex>
                      <Box flex="2">
                        <RangeSlider
                          name="rateLimit.window"
                          allowedValues={Array.from(RATE_LIMIT_FORMAT_MAP.keys())}
                          value={value && value.window}
                          placeholder={t('Window')}
                          formatLabel={formatRateLimitWindow}
                          disabled={disabled || !hasFeature}
                          onChange={this.handleChangeWindow.bind(
                            this,
                            onChange,
                            onBlur,
                            value
                          )}
                        />
                      </Box>
                    </Flex>
                  )}
                </FormField>
              </PanelBody>
            </Panel>
          )}
        </Feature>
      </Form>
    );
  }
}

const KeySettings = createReactClass({
  displayName: 'KeySettings',

  propTypes: {
    data: SentryTypes.ProjectKey.isRequired,
    onRemove: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {loading: false};
  },

  handleRemove(e) {
    if (this.state.loading) {
      return;
    }

    const loadingIndicator = addLoadingMessage(t('Saving changes..'));
    const {keyId, orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/keys/${keyId}/`, {
      method: 'DELETE',
      success: (d, _, jqXHR) => {
        this.props.onRemove();
        removeIndicator(loadingIndicator);
        addSuccessMessage(t('Revoked key'));
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
        removeIndicator(loadingIndicator);
        addErrorMessage(t('Unable to revoke key'));
      },
    });
  },

  render() {
    const {keyId, orgId, projectId} = this.props.params;
    const {data} = this.props;
    const apiEndpoint = `/projects/${orgId}/${projectId}/keys/${keyId}/`;
    const loaderLink = getDynamicText({
      value: data.dsn.cdn,
      fixed: '__JS_SDK_LOADER_URL__',
    });

    return (
      <Access access={['project:write']}>
        {({hasAccess}) => (
          <React.Fragment>
            <Form
              saveOnBlur
              allowUndo
              apiEndpoint={apiEndpoint}
              apiMethod="PUT"
              initialData={data}
            >
              <Panel>
                <PanelHeader>{t('Details')}</PanelHeader>

                <PanelBody>
                  <TextField
                    name="name"
                    label={t('Name')}
                    disabled={!hasAccess}
                    required={false}
                  />
                  <BooleanField
                    name="isActive"
                    label={t('Enabled')}
                    required={false}
                    disabled={!hasAccess}
                    help={
                      'Accept events from this key? This may be used to temporarily suspend a key.'
                    }
                  />
                  <Field label={t('Created')}>
                    <div className="controls">
                      <DateTime date={data.dateCreated} />
                    </div>
                  </Field>
                </PanelBody>
              </Panel>
            </Form>

            <KeyRateLimitsForm
              params={this.props.params}
              data={data}
              disabled={!hasAccess}
            />

            <Feature features={['organizations:js-loader']}>
              <Form
                saveOnBlur
                apiEndpoint={apiEndpoint}
                apiMethod="PUT"
                initialData={data}
              >
                <Panel>
                  <PanelHeader>{t('JavaScript Loader')}</PanelHeader>
                  <PanelBody>
                    <Field
                      help={tct(
                        'Copy this script into your website to setup our JavaScript SDK without any additional configuration. [link]',
                        {
                          link: (
                            <ExternalLink href="https://docs.sentry.io/platforms/javascript/browser/">
                              What does the script provide?
                            </ExternalLink>
                          ),
                        }
                      )}
                      inline={false}
                      flexibleControlStateSize
                    >
                      <TextCopyInput
                      >{`<script src='${loaderLink}' crossorigin="anonymous"></script>`}</TextCopyInput>
                    </Field>
                    <SelectField
                      name="browserSdkVersion"
                      choices={data.browserSdk ? data.browserSdk.choices : []}
                      placeholder={t('4.x')}
                      allowClear={false}
                      enabled={!hasAccess}
                      help={t('Select the version of the SDK that should be loaded')}
                    />
                  </PanelBody>
                </Panel>
              </Form>
            </Feature>

            <Panel>
              <PanelHeader>{t('Credentials')}</PanelHeader>
              <PanelBody>
                <PanelAlert type="info" icon="icon-circle-exclamation">
                  {t(
                    'Your credentials are coupled to a public and secret key. Different clients will require different credentials, so make sure you check the documentation before plugging things in.'
                  )}
                </PanelAlert>

                <ProjectKeyCredentials
                  projectId={`${data.projectId}`}
                  data={data}
                  showPublicKey
                  showSecretKey
                  showProjectId
                />
              </PanelBody>
            </Panel>

            <Access access={['project:admin']}>
              <Panel>
                <PanelHeader>{t('Revoke Key')}</PanelHeader>
                <PanelBody>
                  <Field
                    label={t('Revoke Key')}
                    help={t(
                      'Revoking this key will immediately remove and suspend the credentials. This action is irreversible.'
                    )}
                  >
                    <div>
                      <Confirm
                        priority="danger"
                        message={t(
                          'Are you sure you want to revoke this key? This will immediately remove and suspend the credentials.'
                        )}
                        onConfirm={this.handleRemove}
                        confirmText={t('Revoke Key')}
                      >
                        <Button priority="danger">{t('Revoke Key')}</Button>
                      </Confirm>
                    </div>
                  </Field>
                </PanelBody>
              </Panel>
            </Access>
          </React.Fragment>
        )}
      </Access>
    );
  },
});

export default class ProjectKeyDetails extends AsyncView {
  getTitle() {
    return t('Key Details');
  }

  getEndpoints() {
    const {keyId, orgId, projectId} = this.props.params;
    return [['data', `/projects/${orgId}/${projectId}/keys/${keyId}/`]];
  }

  handleRemove = data => {
    const {orgId, projectId} = this.props.params;
    browserHistory.push(`/${orgId}/${projectId}/settings/keys/`);
  };

  renderBody() {
    const {data} = this.state;
    const {params} = this.props;

    return (
      <div className="ref-key-details">
        <SettingsPageHeader title={t('Key Details')} />
        <PermissionAlert />

        <KeyStats params={params} />

        <KeySettings params={params} data={data} onRemove={this.handleRemove} />
      </div>
    );
  }
}
