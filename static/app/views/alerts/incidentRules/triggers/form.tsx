import * as React from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {Client} from 'sentry/api';
import CircleIndicator from 'sentry/components/circleIndicator';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Config, Organization, Project} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import withConfig from 'sentry/utils/withConfig';
import ThresholdControl from 'sentry/views/alerts/incidentRules/triggers/thresholdControl';
import Field from 'sentry/views/settings/components/forms/field';

import {isSessionAggregate} from '../../utils';
import {
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  ThresholdControlValue,
  Trigger,
  UnsavedIncidentRule,
  UnsavedTrigger,
} from '../types';

type Props = {
  api: Client;
  config: Config;
  disabled: boolean;
  organization: Organization;

  /**
   * Map of fieldName -> errorMessage
   */
  error?: {[fieldName: string]: string};
  projects: Project[];
  resolveThreshold: UnsavedIncidentRule['resolveThreshold'];
  thresholdType: UnsavedIncidentRule['thresholdType'];
  comparisonType: AlertRuleComparisonType;
  aggregate: UnsavedIncidentRule['aggregate'];
  trigger: Trigger;
  triggerIndex: number;
  isCritical: boolean;
  fieldHelp: React.ReactNode;
  triggerLabel: React.ReactNode;
  placeholder: string;

  onChange: (trigger: Trigger, changeObj: Partial<Trigger>) => void;
  onThresholdTypeChange: (thresholdType: AlertRuleThresholdType) => void;
};

class TriggerForm extends React.PureComponent<Props> {
  /**
   * Handler for threshold changes coming from slider or chart.
   * Needs to sync state with the form.
   */
  handleChangeThreshold = (value: ThresholdControlValue) => {
    const {onChange, trigger} = this.props;

    onChange(
      {
        ...trigger,
        alertThreshold: value.threshold,
      },
      {alertThreshold: value.threshold}
    );
  };

  render() {
    const {
      disabled,
      error,
      trigger,
      isCritical,
      thresholdType,
      comparisonType,
      fieldHelp,
      triggerLabel,
      placeholder,
      onThresholdTypeChange,
    } = this.props;

    return (
      <Field
        label={triggerLabel}
        help={fieldHelp}
        required={isCritical}
        error={error && error.alertThreshold}
      >
        <ThresholdControl
          disabled={disabled}
          disableThresholdType={!isCritical}
          type={trigger.label}
          thresholdType={thresholdType}
          threshold={trigger.alertThreshold}
          comparisonType={comparisonType}
          placeholder={placeholder}
          onChange={this.handleChangeThreshold}
          onThresholdTypeChange={onThresholdTypeChange}
        />
      </Field>
    );
  }
}

type TriggerFormContainerProps = Omit<
  React.ComponentProps<typeof TriggerForm>,
  | 'onChange'
  | 'isCritical'
  | 'error'
  | 'triggerIndex'
  | 'trigger'
  | 'fieldHelp'
  | 'triggerHelp'
  | 'triggerLabel'
  | 'placeholder'
> & {
  triggers: Trigger[];
  errors?: Map<number, {[fieldName: string]: string}>;
  onChange: (triggerIndex: number, trigger: Trigger, changeObj: Partial<Trigger>) => void;
  onResolveThresholdChange: (
    resolveThreshold: UnsavedIncidentRule['resolveThreshold']
  ) => void;
};

class TriggerFormContainer extends React.Component<TriggerFormContainerProps> {
  componentDidMount() {
    const {api, organization} = this.props;

    fetchOrgMembers(api, organization.slug);
  }

  handleChangeTrigger =
    (triggerIndex: number) => (trigger: Trigger, changeObj: Partial<Trigger>) => {
      const {onChange} = this.props;
      onChange(triggerIndex, trigger, changeObj);
    };

  handleChangeResolveTrigger = (trigger: Trigger, _: Partial<Trigger>) => {
    const {onResolveThresholdChange} = this.props;
    onResolveThresholdChange(trigger.alertThreshold);
  };

  getThresholdUnits(aggregate: string, comparisonType: AlertRuleComparisonType) {
    if (aggregate.includes('duration') || aggregate.includes('measurements')) {
      return 'ms';
    }

    if (
      isSessionAggregate(aggregate) ||
      comparisonType === AlertRuleComparisonType.CHANGE
    ) {
      return '%';
    }

    return '';
  }

  getCriticalThresholdPlaceholder(
    aggregate: string,
    comparisonType: AlertRuleComparisonType
  ) {
    if (aggregate.includes('failure_rate')) {
      return '0.05';
    }

    if (isSessionAggregate(aggregate)) {
      return '97';
    }

    if (comparisonType === AlertRuleComparisonType.CHANGE) {
      return '100';
    }

    return '300';
  }

  render() {
    const {
      api,
      config,
      disabled,
      errors,
      organization,
      triggers,
      thresholdType,
      comparisonType,
      aggregate,
      resolveThreshold,
      projects,
      onThresholdTypeChange,
    } = this.props;

    const resolveTrigger: UnsavedTrigger = {
      label: 'resolve',
      alertThreshold: resolveThreshold,
      actions: [],
    };

    const thresholdUnits = this.getThresholdUnits(aggregate, comparisonType);

    return (
      <React.Fragment>
        {triggers.map((trigger, index) => {
          const isCritical = index === 0;
          // eslint-disable-next-line no-use-before-define
          const TriggerIndicator = isCritical ? CriticalIndicator : WarningIndicator;
          return (
            <TriggerForm
              key={index}
              api={api}
              config={config}
              disabled={disabled}
              error={errors && errors.get(index)}
              trigger={trigger}
              thresholdType={thresholdType}
              comparisonType={comparisonType}
              aggregate={aggregate}
              resolveThreshold={resolveThreshold}
              organization={organization}
              projects={projects}
              triggerIndex={index}
              isCritical={isCritical}
              fieldHelp={tct(
                'The threshold[units] that will activate the [severity] status.',
                {
                  severity: isCritical ? t('critical') : t('warning'),
                  units: thresholdUnits ? ` (${thresholdUnits})` : '',
                }
              )}
              triggerLabel={
                <React.Fragment>
                  <TriggerIndicator size={12} />
                  {isCritical ? t('Critical') : t('Warning')}
                </React.Fragment>
              }
              placeholder={
                isCritical
                  ? `${this.getCriticalThresholdPlaceholder(aggregate, comparisonType)}${
                      comparisonType === AlertRuleComparisonType.COUNT
                        ? thresholdUnits
                        : ''
                    }`
                  : t('None')
              }
              onChange={this.handleChangeTrigger(index)}
              onThresholdTypeChange={onThresholdTypeChange}
            />
          );
        })}
        <TriggerForm
          api={api}
          config={config}
          disabled={disabled}
          error={errors && errors.get(2)}
          trigger={resolveTrigger}
          // Flip rule thresholdType to opposite
          thresholdType={+!thresholdType}
          comparisonType={comparisonType}
          aggregate={aggregate}
          resolveThreshold={resolveThreshold}
          organization={organization}
          projects={projects}
          triggerIndex={2}
          isCritical={false}
          fieldHelp={tct('The threshold[units] that will activate the resolved status.', {
            units: thresholdUnits ? ` (${thresholdUnits})` : '',
          })}
          triggerLabel={
            <React.Fragment>
              <ResolvedIndicator size={12} />
              {t('Resolved')}
            </React.Fragment>
          }
          placeholder={t('Automatic')}
          onChange={this.handleChangeResolveTrigger}
          onThresholdTypeChange={onThresholdTypeChange}
        />
      </React.Fragment>
    );
  }
}

const CriticalIndicator = styled(CircleIndicator)`
  background: ${p => p.theme.red300};
  margin-right: ${space(1)};
`;

const WarningIndicator = styled(CircleIndicator)`
  background: ${p => p.theme.yellow300};
  margin-right: ${space(1)};
`;

const ResolvedIndicator = styled(CircleIndicator)`
  background: ${p => p.theme.green300};
  margin-right: ${space(1)};
`;

export default withConfig(withApi(TriggerFormContainer));
