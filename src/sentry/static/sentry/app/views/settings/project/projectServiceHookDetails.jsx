import {browserHistory} from 'react-router';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../../../locale';
import AsyncComponent from '../../../components/asyncComponent';
import AsyncView from '../../asyncView';
import {Panel, PanelAlert, PanelBody, PanelHeader} from '../../../components/panels';
import Button from '../../../components/buttons/button';
import EmptyMessage from '../components/emptyMessage';
import ErrorBoundary from '../../../components/errorBoundary';
import Field from '../components/forms/field';
import getDynamicText from '../../../utils/getDynamicText';
import IndicatorStore from '../../../stores/indicatorStore';
import SettingsPageHeader from '../components/settingsPageHeader';
import StackedBarChart from '../../../components/stackedBarChart';
import TextBlock from '../components/text/textBlock';
import TextCopyInput from '../components/forms/textCopyInput';

import ServiceHookSettingsForm from './serviceHookSettingsForm';

// TODO(dcramer): this is duplicated in ProjectKeyDetails
const EmptyHeader = styled.div`
  font-size: 1.3em;
`;

class HookStats extends AsyncComponent {
  getEndpoints() {
    let until = Math.floor(new Date().getTime() / 1000);
    let since = until - 3600 * 24 * 30;
    let {hookId, orgId, projectId} = this.props.params;
    return [
      [
        'stats',
        `/projects/${orgId}/${projectId}/hooks/${hookId}/stats/`,
        {
          query: {
            since,
            until,
            resolution: '1d',
          },
        },
      ],
    ];
  }

  renderTooltip(point, pointIdx, chart) {
    let timeLabel = chart.getTimeLabel(point);
    let [total] = point.y;

    let value = `${total.toLocaleString()} events`;

    return (
      '<div style="width:150px">' +
      `<div class="time-label">${timeLabel}</div>` +
      `<div class="value-label">${value}</div>` +
      '</div>'
    );
  }

  renderBody() {
    let emptyStats = true;
    let stats = this.state.stats.map(p => {
      if (p.total) emptyStats = false;
      return {
        x: p.ts,
        y: [p.accepted, p.dropped],
      };
    });

    return (
      <Panel>
        <PanelHeader>{t('Events in the last 30 days (by day)')}</PanelHeader>
        <PanelBody>
          {!emptyStats ? (
            <StackedBarChart
              points={stats}
              height={150}
              label="events"
              barClasses={['total']}
              className="standard-barchart"
              style={{border: 'none'}}
              tooltip={this.renderTooltip}
            />
          ) : (
            <EmptyMessage css={{flexDirection: 'column', alignItems: 'center'}}>
              <EmptyHeader>{t('Nothing recorded in the last 30 days.')}</EmptyHeader>
              <TextBlock css={{marginBottom: 0}}>
                {t('Total webhooks fired for this configuration.')}
              </TextBlock>
            </EmptyMessage>
          )}
        </PanelBody>
      </Panel>
    );
  }
}

export default class ProjectServiceHookDetails extends AsyncView {
  getEndpoints() {
    let {orgId, projectId, hookId} = this.props.params;
    return [['hook', `/projects/${orgId}/${projectId}/hooks/${hookId}/`]];
  }

  onDelete = () => {
    let {orgId, projectId, hookId} = this.props.params;
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(`/projects/${orgId}/${projectId}/hooks/${hookId}/`, {
      method: 'DELETE',
      success: () => {
        IndicatorStore.remove(loadingIndicator);
        browserHistory.push(`/settings/${orgId}/${projectId}/hooks/`);
      },
      error: () => {
        IndicatorStore.remove(loadingIndicator);
        IndicatorStore.add(
          t('Unable to remove application. Please try again.'),
          'error',
          {
            duration: 3000,
          }
        );
      },
    });
  };

  renderBody() {
    let {orgId, projectId, hookId} = this.props.params;
    let {hook} = this.state;
    return (
      <div>
        <SettingsPageHeader title={t('Service Hook Details')} />

        <ErrorBoundary>
          <HookStats params={this.props.params} />
        </ErrorBoundary>

        <ServiceHookSettingsForm
          {...this.props}
          orgId={orgId}
          projectId={projectId}
          hookId={hookId}
          initialData={{
            ...hook,
            isActive: hook.status != 'disabled',
          }}
        />
        <Panel>
          <PanelHeader>{t('Event Validation')}</PanelHeader>
          <PanelBody>
            <PanelAlert type="info" icon="icon-circle-exclamation" m={0} mb={0}>
              Sentry will send the <code>X-ServiceHook-Signature</code> header built using{' '}
              <code>HMAC(SHA256, [secret], [payload])</code>. You should always verify
              this signature before trusting the information provided in the webhook.
            </PanelAlert>
            <Field
              label={t('Secret')}
              flexibleControlStateSize
              inline={false}
              help={t('The shared secret used for generating event HMAC signatures.')}
            >
              <TextCopyInput>
                {getDynamicText({
                  value: hook.secret,
                  fixed: 'a dynamic secret value',
                })}
              </TextCopyInput>
            </Field>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader>{t('Delete Hook')}</PanelHeader>
          <PanelBody>
            <Field
              label={t('Delete Hook')}
              help={t('Removing this hook is immediate and permanent.')}
            >
              <div>
                <Button priority="danger" onClick={this.onDelete}>
                  Delete Hook
                </Button>
              </div>
            </Field>
          </PanelBody>
        </Panel>
      </div>
    );
  }
}
