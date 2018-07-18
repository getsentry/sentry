import {browserHistory} from 'react-router';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import AsyncView from 'app/views/asyncView';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import Button from 'app/components/buttons/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ErrorBoundary from 'app/components/errorBoundary';
import Field from 'app/views/settings/components/forms/field';
import getDynamicText from 'app/utils/getDynamicText';
import IndicatorStore from 'app/stores/indicatorStore';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import StackedBarChart from 'app/components/stackedBarChart';
import TextBlock from 'app/views/settings/components/text/textBlock';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';

import ServiceHookSettingsForm from 'app/views/settings/project/serviceHookSettingsForm';

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
        y: [p.total],
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
