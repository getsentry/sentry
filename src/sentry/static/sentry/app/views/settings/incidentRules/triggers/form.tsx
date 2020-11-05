import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {Config, Organization, Project} from 'app/types';
import {fetchOrgMembers} from 'app/actionCreators/members';
import {t, tct} from 'app/locale';
import CircleIndicator from 'app/components/circleIndicator';
import Field from 'app/views/settings/components/forms/field';
import ThresholdControl from 'app/views/settings/incidentRules/triggers/thresholdControl';
import withApi from 'app/utils/withApi';
import withConfig from 'app/utils/withConfig';
import space from 'app/styles/space';

import {
  AlertRuleThresholdType,
  Trigger,
  UnsavedIncidentRule,
  ThresholdControlValue,
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

  handleChangeTrigger = (triggerIndex: number) => (
    trigger: Trigger,
    changeObj: Partial<Trigger>
  ) => {
    const {onChange} = this.props;
    onChange(triggerIndex, trigger, changeObj);
  };

  handleChangeResolveTrigger = (trigger: Trigger, _: Partial<Trigger>) => {
    const {onResolveThresholdChange} = this.props;
    onResolveThresholdChange(trigger.alertThreshold);
  };

  render() {
    const {
      api,
      config,
      disabled,
      errors,
      organization,
      triggers,
      thresholdType,
      resolveThreshold,
      projects,
      onThresholdTypeChange,
    } = this.props;

    const resolveTrigger: UnsavedTrigger = {
      label: 'resolve',
      alertThreshold: resolveThreshold,
      actions: [],
    };

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
              resolveThreshold={resolveThreshold}
              organization={organization}
              projects={projects}
              triggerIndex={index}
              isCritical={isCritical}
              fieldHelp={tct('The threshold that will activate the [severity] status.', {
                severity: isCritical ? t('critical') : t('warning'),
              })}
              triggerLabel={
                <React.Fragment>
                  <TriggerIndicator size={12} />
                  {isCritical ? t('Critical Status') : t('Warning Status')}
                </React.Fragment>
              }
              placeholder={isCritical ? '300' : t('None')}
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
          resolveThreshold={resolveThreshold}
          organization={organization}
          projects={projects}
          triggerIndex={2}
          isCritical={false}
          fieldHelp={t('The threshold that will activate the resolved status.')}
          triggerLabel={
            <React.Fragment>
              <ResolvedIndicator size={12} />
              {t('Resolved Status')}
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
  background: ${p => p.theme.red400};
  margin-right: ${space(1)};
`;

const WarningIndicator = styled(CircleIndicator)`
  background: ${p => p.theme.yellow400};
  margin-right: ${space(1)};
`;

const ResolvedIndicator = styled(CircleIndicator)`
  background: ${p => p.theme.green300};
  margin-right: ${space(1)};
`;

export default withConfig(withApi(TriggerFormContainer));
