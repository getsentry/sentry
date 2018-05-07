import {Box, Flex} from 'grid-emotion';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  removeIndicator,
} from 'app/actionCreators/indicator';
import {getOrganizationState} from 'app/mixins/organizationState';
import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import AsyncView from 'app/views/asyncView';
import BooleanField from 'app/views/settings/components/forms/booleanField';
import Button from 'app/components/buttons/button';
import Confirm from 'app/components/confirm';
import DateTime from 'app/components/dateTime';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Field from 'app/views/settings/components/forms/field';
import Form from 'app/views/settings/components/forms/form';
import FormField from 'app/views/settings/components/forms/formField';
import HookStore from 'app/stores/hookStore';
import InputControl from 'app/views/settings/components/forms/controls/input';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import ProjectKeyCredentials from 'app/views/settings/project/projectKeys/projectKeyCredentials';
import RangeSlider from 'app/views/settings/components/forms/controls/rangeSlider';
import SentryTypes from 'app/proptypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import StackedBarChart from 'app/components/stackedBarChart';
import TextBlock from 'app/views/settings/components/text/textBlock';
import TextField from 'app/views/settings/components/forms/textField';
import TextCopyInput from '../../components/forms/textCopyInput';

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
            <EmptyMessage css={{flexDirection: 'column', alignItems: 'center'}}>
              <EmptyHeader>{t('Nothing recorded in the last 30 days.')}</EmptyHeader>
              <TextBlock css={{marginBottom: 0}}>
                {t('Total events captured using these credentials.')}
              </TextBlock>
            </EmptyMessage>
          )}
        </PanelBody>
      </Panel>
    );
  },
});

class KeyRateLimitsForm extends React.Component {
  static propTypes = {
    organization: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    data: SentryTypes.ProjectKey.isRequired,
    enabled: PropTypes.bool,
    hooksDisabled: PropTypes.arrayOf(PropTypes.func),
  };

  handleChangeWindow = (onChange, onBlur, currentValueObj, value, e) => {
    let valueObj = {
      ...currentValueObj,
      window: value,
    };
    onChange(valueObj, e);
    onBlur(valueObj, e);
  };

  handleChangeCount = (cb, value, e) => {
    let valueObj = {
      ...value,
      count: e.target.value,
    };

    cb(valueObj, e);
  };

  render() {
    let {enabled, data, project, organization, hooksDisabled} = this.props;
    let {keyId, orgId, projectId} = this.props.params;
    let apiEndpoint = `/projects/${orgId}/${projectId}/keys/${keyId}/`;
    let showPanel = enabled || !!hooksDisabled.length;

    if (!showPanel) return null;

    return (
      <Form saveOnBlur apiEndpoint={apiEndpoint} apiMethod="PUT" initialData={data}>
        <Panel>
          <PanelHeader>{t('Rate Limits')}</PanelHeader>
          {!enabled ? (
            <PanelBody disablePadding={false}>
              {hooksDisabled
                .map(hook => {
                  return hook(organization, project, data);
                })
                .shift()}
            </PanelBody>
          ) : (
            <PanelBody>
              <PanelAlert type="info" icon="icon-circle-exclamation" m={0} mb={0}>
                {t(
                  'Rate limits provide a flexible way to manage your event volume. If you have a noisy project or environment you can configure a rate limit for this key to reduce the number of events processed.'
                )}
              </PanelAlert>

              <FormField
                className="rate-limit-group"
                name="rateLimit"
                label={t('Rate Limit')}
                validate={({id, form, model}) => {
                  let isValid =
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
                {({onChange, onBlur, value}) => {
                  return (
                    <Flex>
                      <Flex flex="2" align="center">
                        <InputControl
                          type="number"
                          name="rateLimit.count"
                          min={0}
                          value={value && value.count}
                          placeholder={t('Count')}
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
                          onChange={this.handleChangeWindow.bind(
                            this,
                            onChange,
                            onBlur,
                            value
                          )}
                        />
                      </Box>
                    </Flex>
                  );
                }}
              </FormField>
            </PanelBody>
          )}
        </Panel>
      </Form>
    );
  }
}

const KeySettings = createReactClass({
  displayName: 'KeySettings',

  propTypes: {
    organization: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    access: PropTypes.object.isRequired,
    data: SentryTypes.ProjectKey.isRequired,
    onRemove: PropTypes.func.isRequired,
    rateLimitsEnabled: PropTypes.bool,
    relayEnabled: PropTypes.bool,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      hooksDisabled: HookStore.get('project:rate-limits:disabled'),
    };
  },

  handleRemove(e) {
    if (this.state.loading) return;

    let loadingIndicator = addLoadingMessage(t('Saving changes..'));
    let {keyId, orgId, projectId} = this.props.params;
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
    let {keyId, orgId, projectId} = this.props.params;
    let {
      access,
      data,
      rateLimitsEnabled,
      relayEnabled,
      organization,
      project,
    } = this.props;
    let apiEndpoint = `/projects/${orgId}/${projectId}/keys/${keyId}/`;

    return (
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
              <TextField name="name" label={t('Name')} required={false} />

              <BooleanField
                name="isActive"
                label={t('Enabled')}
                required={false}
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
          organization={organization}
          project={project}
          enabled={rateLimitsEnabled}
          hooksDisabled={this.state.hooksDisabled}
        />

        {relayEnabled && (
          <Form
            saveOnBlur
            allowUndo
            apiEndpoint={apiEndpoint}
            apiMethod="PUT"
            initialData={data}
          >
            <Panel>
              <PanelHeader>{t('CDN')}</PanelHeader>
              <PanelBody>
                <TextField
                  name="jsSdkUrl"
                  help={t(
                    'Change this to the URL of the SDK of your choice. By default this is the latest SDK version. If you set an URL here you need to update it manually.'
                  )}
                  label={t('Url of SDK to be loaded')}
                  placeholder={t('Leave empty to use default')}
                  required={false}
                />

                <Field
                  help={t('Copy this into your website and you are good to go')}
                  inline={false}
                  flexibleControlStateSize
                >
                  <TextCopyInput>{`<script src='${data.relay
                    .url}'></script>`}</TextCopyInput>
                </Field>
              </PanelBody>
            </Panel>
          </Form>
        )}

        <Panel>
          <PanelHeader>{t('Credentials')}</PanelHeader>
          <PanelBody>
            <PanelAlert type="info" icon="icon-circle-exclamation" m={0} mb={0}>
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

        {access.has('project:admin') && (
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
        )}
      </React.Fragment>
    );
  },
});

export default class ProjectKeyDetails extends AsyncView {
  static contextTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  getTitle() {
    return t('Key Details');
  }

  getEndpoints() {
    let {keyId, orgId, projectId} = this.props.params;
    return [['data', `/projects/${orgId}/${projectId}/keys/${keyId}/`]];
  }

  handleRemove = data => {
    let {orgId, projectId} = this.props.params;
    browserHistory.push(`/${orgId}/${projectId}/settings/keys/`);
  };

  renderBody() {
    let {data} = this.state;
    let {params} = this.props;
    let {organization, project} = this.context;
    let access = getOrganizationState(organization).getAccess();
    let features = new Set(project.features);
    let hasRateLimitsEnabled = features.has('rate-limits');
    let orgFeatures = new Set(organization.features);
    let hasRelayEnabled = orgFeatures.has('relay');

    return (
      <div className="ref-key-details">
        <SettingsPageHeader title={t('Key Details')} />

        <KeyStats params={params} />

        <KeySettings
          organization={organization}
          project={project}
          access={access}
          params={params}
          rateLimitsEnabled={hasRateLimitsEnabled}
          relayEnabled={hasRelayEnabled}
          data={data}
          onRemove={this.handleRemove}
        />
      </div>
    );
  }
}

const EmptyHeader = styled.div`
  font-size: 1.3em;
`;
