import * as React from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {Client} from 'sentry/api';
import CircleIndicator from 'sentry/components/circleIndicator';
import Field from 'sentry/components/forms/field';
import {IconDiamond} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Config, Organization, Project} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import withConfig from 'sentry/utils/withConfig';
import ThresholdControl from 'sentry/views/alerts/incidentRules/triggers/thresholdControl';

import {isSessionAggregate} from '../../utils';
import {
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  AlertRuleTriggerType,
  ThresholdControlValue,
  Trigger,
  UnsavedIncidentRule,
  UnsavedTrigger,
} from '../types';

type Props = {
  aggregate: UnsavedIncidentRule['aggregate'];
  api: Client;
  comparisonType: AlertRuleComparisonType;
  config: Config;

  disabled: boolean;
  fieldHelp: React.ReactNode;
  hasAlertWizardV3: boolean;
  isCritical: boolean;
  onChange: (trigger: Trigger, changeObj: Partial<Trigger>) => void;
  onThresholdPeriodChange: (value: number) => void;
  onThresholdTypeChange: (thresholdType: AlertRuleThresholdType) => void;
  organization: Organization;
  placeholder: string;
  projects: Project[];
  resolveThreshold: UnsavedIncidentRule['resolveThreshold'];
  thresholdPeriod: UnsavedIncidentRule['thresholdPeriod'];
  thresholdType: UnsavedIncidentRule['thresholdType'];
  trigger: Trigger;

  triggerIndex: number;
  triggerLabel: React.ReactNode;
  /**
   * Map of fieldName -> errorMessage
   */
  error?: {[fieldName: string]: string};

  hideControl?: boolean;
};

class TriggerFormItem extends React.PureComponent<Props> {
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
      thresholdPeriod,
      hasAlertWizardV3,
      hideControl,
      comparisonType,
      fieldHelp,
      triggerLabel,
      placeholder,
      onThresholdTypeChange,
      onThresholdPeriodChange,
    } = this.props;

    return (
      <StyledField
        label={triggerLabel}
        help={fieldHelp}
        required={isCritical}
        error={error && error.alertThreshold}
        hasAlertWizardV3={hasAlertWizardV3}
      >
        <ThresholdControl
          disabled={disabled}
          disableThresholdType={!isCritical}
          type={trigger.label}
          thresholdType={thresholdType}
          thresholdPeriod={thresholdPeriod}
          hideControl={hideControl}
          threshold={trigger.alertThreshold}
          comparisonType={comparisonType}
          placeholder={placeholder}
          onChange={this.handleChangeThreshold}
          onThresholdTypeChange={onThresholdTypeChange}
          onThresholdPeriodChange={onThresholdPeriodChange}
        />
      </StyledField>
    );
  }
}

type TriggerFormContainerProps = Omit<
  React.ComponentProps<typeof TriggerFormItem>,
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
  hasAlertWizardV3: boolean;
  onChange: (triggerIndex: number, trigger: Trigger, changeObj: Partial<Trigger>) => void;
  onResolveThresholdChange: (
    resolveThreshold: UnsavedIncidentRule['resolveThreshold']
  ) => void;
  triggers: Trigger[];
  errors?: Map<number, {[fieldName: string]: string}>;
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

  getIndicator(type: AlertRuleTriggerType) {
    const {hasAlertWizardV3} = this.props;

    if (type === AlertRuleTriggerType.CRITICAL) {
      return hasAlertWizardV3 ? (
        <StyledIconDiamond color="red300" size="sm" />
      ) : (
        <CriticalIndicator size={12} />
      );
    }

    if (type === AlertRuleTriggerType.WARNING) {
      return hasAlertWizardV3 ? (
        <StyledIconDiamond color="yellow300" size="sm" />
      ) : (
        <WarningIndicator size={12} />
      );
    }

    return hasAlertWizardV3 ? (
      <StyledIconDiamond color="green300" size="sm" />
    ) : (
      <ResolvedIndicator size={12} />
    );
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
      thresholdPeriod,
      comparisonType,
      aggregate,
      resolveThreshold,
      projects,
      hasAlertWizardV3,
      onThresholdTypeChange,
      onThresholdPeriodChange,
    } = this.props;

    const resolveTrigger: UnsavedTrigger = {
      label: AlertRuleTriggerType.RESOLVE,
      alertThreshold: resolveThreshold,
      actions: [],
    };

    const thresholdUnits = this.getThresholdUnits(aggregate, comparisonType);

    return (
      <React.Fragment>
        {triggers.map((trigger, index) => {
          const isCritical = index === 0;
          // eslint-disable-next-line no-use-before-define
          return (
            <TriggerFormItem
              key={index}
              api={api}
              config={config}
              disabled={disabled}
              error={errors && errors.get(index)}
              trigger={trigger}
              thresholdPeriod={thresholdPeriod}
              thresholdType={thresholdType}
              comparisonType={comparisonType}
              aggregate={aggregate}
              resolveThreshold={resolveThreshold}
              organization={organization}
              projects={projects}
              triggerIndex={index}
              isCritical={isCritical}
              hasAlertWizardV3={hasAlertWizardV3}
              fieldHelp={
                hasAlertWizardV3
                  ? null
                  : tct(
                      'The threshold[units] that will activate the [severity] status.',
                      {
                        severity: isCritical ? t('critical') : t('warning'),
                        units: thresholdUnits ? ` (${thresholdUnits})` : '',
                      }
                    )
              }
              triggerLabel={
                <TriggerLabel>
                  {this.getIndicator(
                    isCritical
                      ? AlertRuleTriggerType.CRITICAL
                      : AlertRuleTriggerType.WARNING
                  )}
                  {isCritical ? t('Critical') : t('Warning')}
                </TriggerLabel>
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
              onThresholdPeriodChange={onThresholdPeriodChange}
            />
          );
        })}
        <TriggerFormItem
          api={api}
          config={config}
          disabled={disabled}
          error={errors && errors.get(2)}
          trigger={resolveTrigger}
          // Flip rule thresholdType to opposite
          thresholdPeriod={thresholdPeriod}
          thresholdType={+!thresholdType}
          hideControl={hasAlertWizardV3}
          comparisonType={comparisonType}
          aggregate={aggregate}
          resolveThreshold={resolveThreshold}
          organization={organization}
          projects={projects}
          triggerIndex={2}
          isCritical={false}
          hasAlertWizardV3={hasAlertWizardV3}
          fieldHelp={
            hasAlertWizardV3
              ? null
              : tct('The threshold[units] that will activate the resolved status.', {
                  units: thresholdUnits ? ` (${thresholdUnits})` : '',
                })
          }
          triggerLabel={
            <TriggerLabel>
              {this.getIndicator(AlertRuleTriggerType.RESOLVE)}
              {t('Resolved')}
            </TriggerLabel>
          }
          placeholder={t('Automatic')}
          onChange={this.handleChangeResolveTrigger}
          onThresholdTypeChange={onThresholdTypeChange}
          onThresholdPeriodChange={onThresholdPeriodChange}
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

const TriggerLabel = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const StyledIconDiamond = styled(IconDiamond)`
  margin-right: ${space(0.75)};
`;

const StyledField = styled(Field)<{hasAlertWizardV3: boolean}>`
  & > label > div:first-child > span {
    display: flex;
    flex-direction: row;
  }
`;

export default withConfig(withApi(TriggerFormContainer));
