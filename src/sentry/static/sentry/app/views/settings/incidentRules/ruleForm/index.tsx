import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Client} from 'app/api';
import {MetricAction} from 'app/types/alerts';
import {Organization, Project, Config} from 'app/types';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {createDefaultTrigger} from 'app/views/settings/incidentRules/constants';
import {defined} from 'app/utils';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import Form from 'app/views/settings/components/forms/form';
import RuleNameForm from 'app/views/settings/incidentRules/ruleNameForm';
import Triggers from 'app/views/settings/incidentRules/triggers';
import TriggersChart from 'app/views/settings/incidentRules/triggers/chart';
import withApi from 'app/utils/withApi';
import withConfig from 'app/utils/withConfig';
import withProject from 'app/utils/withProject';

import {AlertRuleAggregations, IncidentRule, Trigger} from '../types';
import RuleConditionsForm from '../ruleConditionsForm';
import FormModel from '../../components/forms/model';
import {addOrUpdateRule} from '../actions';

type Props = {
  api: Client;
  config: Config;
  organization: Organization;
  project: Project;
  rule: IncidentRule;
  incidentRuleId?: string;
} & Pick<RouteComponentProps<{orgId: string; projectId: string}, {}>, 'params'> & {
    onSubmitSuccess?: Form['props']['onSubmitSuccess'];
  } & AsyncComponent['props'];

type State = {
  triggers: Trigger[];
  projects: Project[];
  triggerErrors: Map<number, {[fieldName: string]: string}>;

  // `null` means loading
  availableActions: MetricAction[] | null;

  // Rule conditions form inputs
  // Needed for TriggersChart
  query: string;
  aggregation: AlertRuleAggregations;
  timeWindow: number;
} & AsyncComponent['state'];

const isEmpty = (str: unknown): boolean => str === '' || !defined(str);

class RuleFormContainer extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    const {rule} = this.props;

    return {
      ...super.getDefaultState(),

      aggregation: rule.aggregation,
      query: rule.query || '',
      timeWindow: rule.timeWindow,
      triggerErrors: new Map(),
      availableActions: null,
      triggers: this.props.rule.triggers,
      projects: [this.props.project],
    };
  }

  getEndpoints(): [string, string][] {
    const {params} = this.props;

    // TODO(incidents): This is temporary until new API endpoints
    // We should be able to just fetch the rule if rule.id exists

    return [
      [
        'availableActions',
        `/organizations/${params.orgId}/alert-rules/available-actions/`,
      ],
    ];
  }

  validateFieldInTrigger({errors, triggerIndex, field, message, isValid}) {
    // If valid, reset error for fieldName
    if (isValid()) {
      const {[field]: _validatedField, ...otherErrors} = errors.get(triggerIndex) || {};

      if (Object.keys(otherErrors).length > 0) {
        errors.set(triggerIndex, otherErrors);
      } else {
        errors.delete(triggerIndex);
      }

      return errors;
    }

    if (!errors.has(triggerIndex)) {
      errors.set(triggerIndex, {});
    }
    const currentErrors = errors.get(triggerIndex);

    errors.set(triggerIndex, {
      ...currentErrors,
      [field]: message,
    });

    return errors;
  }

  /**
   * Validate triggers
   *
   * @return Returns true if triggers are valid
   */
  validateTriggers(triggers = this.state.triggers) {
    const triggerErrors = new Map();

    const requiredFields = ['label', 'alertThreshold'];
    triggers.forEach((trigger, triggerIndex) => {
      requiredFields.forEach(field => {
        // check required fields
        this.validateFieldInTrigger({
          errors: triggerErrors,
          triggerIndex,
          isValid: () => !isEmpty(trigger[field]),
          field,
          message: t('Field is required'),
        });
      });
    });

    return triggerErrors;
  }

  handleFieldChange = (name: string, value: unknown) => {
    if (['query', 'timeWindow', 'aggregation'].includes(name)) {
      this.setState({[name]: value});
    }
  };

  handleSubmit = async (
    _data: Partial<IncidentRule>,
    _onSubmitSuccess,
    _onSubmitError,
    _e,
    model: FormModel
  ) => {
    // This validates all fields *except* for Triggers
    const validRule = model.validateForm();

    // Validate Triggers
    const triggerErrors = this.validateTriggers();
    const validTriggers = Array.from(triggerErrors).length === 0;

    if (!validTriggers) {
      this.setState(state => ({
        triggerErrors: new Map([...triggerErrors, ...state.triggerErrors]),
      }));
    }

    if (!validRule || !validTriggers) {
      addErrorMessage(t('Alert not valid'));
      return;
    }

    const {api, organization, rule, onSubmitSuccess} = this.props;

    // form model has all form state data, however we use local state to keep
    // track of the list of triggers (and actions within triggers)
    try {
      addLoadingMessage(t('Saving alert'));
      const resp = await addOrUpdateRule(api, organization.slug, {
        ...rule,
        ...model.getTransformedData(),
        triggers: this.state.triggers,
      });
      addSuccessMessage(t('Successfully saved alert'));
      if (onSubmitSuccess) {
        onSubmitSuccess(resp, model);
      }
    } catch (err) {
      addErrorMessage(t('Unable to save alert'));
    }
  };

  /**
   * Add a new trigger
   */
  handleAddTrigger = () => {
    this.setState(({triggers}) => ({
      triggers: [...triggers, createDefaultTrigger()],
    }));
  };

  /**
   * Callback for when triggers change
   */
  handleChangeTriggers = (triggers: Trigger[]) => {
    this.setState(state => {
      let triggerErrors = state.triggerErrors;

      // If we have an existing trigger error, we should attempt to
      // re-validate triggers when triggers has a change
      //
      // Otherwise wait until submit to validate triggers
      if (Array.from(state.triggerErrors).length > 0) {
        const newTriggerErrors = this.validateTriggers(triggers);
        triggerErrors = newTriggerErrors;

        if (Array.from(newTriggerErrors).length === 0) {
          clearIndicators();
        }
      }

      return {triggers, triggerErrors};
    });
  };

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {
      api,
      config,
      organization,
      incidentRuleId,
      rule,
      params,
      onSubmitSuccess,
    } = this.props;
    const {query, aggregation, timeWindow, triggers} = this.state;

    return (
      <Form
        apiMethod={incidentRuleId ? 'PUT' : 'POST'}
        apiEndpoint={`/organizations/${organization.slug}/alert-rules/${
          incidentRuleId ? `${incidentRuleId}/` : ''
        }`}
        initialData={{
          name: rule.name || '',
          aggregation: rule.aggregation,
          query: rule.query || '',
          timeWindow: rule.timeWindow,
        }}
        saveOnBlur={false}
        onSubmit={this.handleSubmit}
        onSubmitSuccess={onSubmitSuccess}
        onFieldChange={this.handleFieldChange}
      >
        <TriggersChart
          api={api}
          config={config}
          organization={organization}
          projects={this.state.projects}
          triggers={triggers}
          query={query}
          aggregation={aggregation}
          timeWindow={timeWindow}
        />

        <RuleConditionsForm organization={organization} />

        <Triggers
          projects={this.state.projects}
          errors={this.state.triggerErrors}
          triggers={triggers}
          currentProject={params.projectId}
          organization={organization}
          incidentRuleId={incidentRuleId}
          availableActions={this.state.availableActions}
          onChange={this.handleChangeTriggers}
          onAdd={this.handleAddTrigger}
        />

        <RuleNameForm />
      </Form>
    );
  }
}

export {RuleFormContainer};
export default withConfig(withApi(withProject(RuleFormContainer)));
