import {Component, Fragment, PureComponent} from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {Client} from 'sentry/api';
import Field from 'sentry/components/forms/field';
import {IconDiamond} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Config, Organization, Project} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import withConfig from 'sentry/utils/withConfig';
import {getThresholdUnits} from 'sentry/views/alerts/rules/metric/constants';
import ThresholdControl from 'sentry/views/alerts/rules/metric/triggers/thresholdControl';

import {isSessionAggregate} from '../../../utils';
import {
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  AlertRuleTriggerType,
  ThresholdControlValue,
  Trigger,
  UnsavedMetricRule,
  UnsavedTrigger,
} from '../types';

type Props = {
  aggregate: UnsavedMetricRule['aggregate'];
  api: Client;
  comparisonType: AlertRuleComparisonType;
  config: Config;

  disabled: boolean;
  fieldHelp: React.ReactNode;
  isCritical: boolean;
  onChange: (trigger: Trigger, changeObj: Partial<Trigger>) => void;
  onThresholdPeriodChange: (value: number) => void;
  onThresholdTypeChange: (thresholdType: AlertRuleThresholdType) => void;
  organization: Organization;
  placeholder: string;
  projects: Project[];
  resolveThreshold: UnsavedMetricRule['resolveThreshold'];
  thresholdPeriod: UnsavedMetricRule['thresholdPeriod'];
  thresholdType: UnsavedMetricRule['thresholdType'];
  trigger: Trigger;

  triggerIndex: number;
  triggerLabel: React.ReactNode;
  /**
   * Map of fieldName -> errorMessage
   */
  error?: {[fieldName: string]: string};

  hideControl?: boolean;
};

class TriggerFormItem extends PureComponent<Props> {
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
  onChange: (triggerIndex: number, trigger: Trigger, changeObj: Partial<Trigger>) => void;
  onResolveThresholdChange: (
    resolveThreshold: UnsavedMetricRule['resolveThreshold']
  ) => void;
  triggers: Trigger[];
  errors?: Map<number, {[fieldName: string]: string}>;
};

class TriggerFormContainer extends Component<TriggerFormContainerProps> {
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
    if (type === AlertRuleTriggerType.CRITICAL) {
      return <StyledIconDiamond color="errorText" size="sm" />;
    }

    if (type === AlertRuleTriggerType.WARNING) {
      return <StyledIconDiamond color="warningText" size="sm" />;
    }

    return <StyledIconDiamond color="successText" size="sm" />;
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
      onThresholdTypeChange,
      onThresholdPeriodChange,
    } = this.props;

    const resolveTrigger: UnsavedTrigger = {
      label: AlertRuleTriggerType.RESOLVE,
      alertThreshold: resolveThreshold,
      actions: [],
    };

    const thresholdUnits = getThresholdUnits(aggregate, comparisonType);

    return (
      <Fragment>
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
              fieldHelp={null}
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
          comparisonType={comparisonType}
          aggregate={aggregate}
          resolveThreshold={resolveThreshold}
          organization={organization}
          projects={projects}
          triggerIndex={2}
          isCritical={false}
          fieldHelp={null}
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
      </Fragment>
    );
  }
}

const TriggerLabel = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const StyledIconDiamond = styled(IconDiamond)`
  margin-right: ${space(0.75)};
`;

const StyledField = styled(Field)`
  & > label > div:first-child > span {
    display: flex;
    flex-direction: row;
  }
`;

export default withConfig(withApi(TriggerFormContainer));
