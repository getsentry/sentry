import {PlainRoute} from 'react-router/lib/Route';
import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Organization, Project} from 'app/types';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {createDefaultTrigger} from 'app/views/settings/incidentRules/constants';
import {defined} from 'app/utils';
import {fetchOrganizationTags} from 'app/actionCreators/tags';
import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import Form from 'app/views/settings/components/forms/form';
import RuleNameForm from 'app/views/settings/incidentRules/ruleNameForm';
import Triggers from 'app/views/settings/incidentRules/triggers';
import TriggersChart from 'app/views/settings/incidentRules/triggers/chart';
import hasThresholdValue from 'app/views/settings/incidentRules/utils/hasThresholdValue';
import recreateRoute from 'app/utils/recreateRoute';
import withProject from 'app/utils/withProject';

import {
  AlertRuleAggregations,
  AlertRuleThresholdType,
  IncidentRule,
  MetricActionTemplate,
  Trigger,
} from '../types';
import {addOrUpdateRule} from '../actions';
import FormModel from '../../components/forms/model';
import RuleConditionsForm from '../ruleConditionsForm';

type Props = {
  organization: Organization;
  project: Project;
  routes: PlainRoute[];
  rule: IncidentRule;
  ruleId?: string;
} & RouteComponentProps<{orgId: string; projectId: string; ruleId?: string}, {}> & {
    onSubmitSuccess?: Form['props']['onSubmitSuccess'];
  } & AsyncComponent['props'];

type State = {
  triggers: Trigger[];
  projects: Project[];
  triggerErrors: Map<number, {[fieldName: string]: string}>;

  // `null` means loading
  availableActions: MetricActionTemplate[] | null;

  // Rule conditions form inputs
  // Needed for TriggersChart
  query: string;
  aggregation: AlertRuleAggregations;
  timeWindow: number;
} & AsyncComponent['state'];

const isEmpty = (str: unknown): boolean => str === '' || !defined(str);

class RuleFormContainer extends AsyncComponent<Props, State> {
  componentDidMount() {
    const {organization, project} = this.props;
    // SearchBar gets its tags from Reflux.
    fetchOrganizationTags(this.api, organization.slug, [project.id]);
  }

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

  getEventType() {
    // XXX: This is hardcoded for now, this will need to change when we add
    // metric types that require different `event.type` (e.g. transactions)
    return 'event.type:error';
  }

  goBack() {
    const {router, routes, params, location} = this.props;

    router.replace(recreateRoute('', {routes, params, location, stepBack: -2}));
  }

  /**
   * Checks to see if threshold is valid given target value, and state of
   * inverted threshold as well as the *other* threshold
   *
   * @param type The threshold type to be updated
   * @param value The new threshold value
   */
  isValidTrigger = (
    triggerIndex: number,
    trigger: Trigger,
    errors,
    changeObj?: Partial<Trigger>
  ): boolean => {
    const {alertThreshold, resolveThreshold} = trigger;

    // If value and/or other value is empty
    // then there are no checks to perform against
    if (!hasThresholdValue(alertThreshold) || !hasThresholdValue(resolveThreshold)) {
      return true;
    }

    // If this is alert threshold and not inverted, it can't be below resolve
    // If this is alert threshold and inverted, it can't be above resolve
    // If this is resolve threshold and not inverted, it can't be above resolve
    // If this is resolve threshold and inverted, it can't be below resolve
    const isValid =
      trigger.thresholdType === AlertRuleThresholdType.BELOW
        ? alertThreshold <= resolveThreshold
        : alertThreshold >= resolveThreshold;

    const otherErrors = errors.get(triggerIndex) || {};
    const isResolveChanged = changeObj?.hasOwnProperty('resolveThreshold');

    if (isValid) {
      return true;
    }

    // Not valid... let's figure out an error message
    const isBelow = trigger.thresholdType === AlertRuleThresholdType.BELOW;
    const thresholdKey = isResolveChanged ? 'resolveThreshold' : 'alertThreshold';
    let errorMessage;

    if (isResolveChanged) {
      errorMessage = isBelow
        ? t('Resolution threshold must be greater than alert')
        : t('Resolution threshold must be less than alert');
    } else {
      errorMessage = isBelow
        ? t('Alert threshold must be less than resolution')
        : t('Alert threshold must be greater than resolution');
    }

    errors.set(triggerIndex, {
      ...otherErrors,
      [thresholdKey]: errorMessage,
    });

    return false;
  };

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
  validateTriggers(
    triggers = this.state.triggers,
    changedTriggerIndex?: number,
    changeObj?: Partial<Trigger>
  ) {
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

      // Check thresholds
      this.isValidTrigger(
        changedTriggerIndex ?? triggerIndex,
        trigger,
        triggerErrors,
        changeObj
      );
    });

    // If we have 2 triggers, we need to make sure that the critical and warning
    // alert thresholds are valid (e.g. if critical is above x, warning must be less than x)
    if (triggers.length === 2) {
      const criticalTriggerIndex = triggers.findIndex(({label}) => label === 'critical');
      const warningTriggerIndex = criticalTriggerIndex ^ 1;
      const criticalTrigger = triggers[criticalTriggerIndex];
      const warningTrigger = triggers[warningTriggerIndex];

      const hasError =
        criticalTrigger.thresholdType === AlertRuleThresholdType.ABOVE
          ? warningTrigger.alertThreshold > criticalTrigger.alertThreshold
          : warningTrigger.alertThreshold < criticalTrigger.alertThreshold;

      if (hasError) {
        [criticalTriggerIndex, warningTriggerIndex].forEach(index => {
          const otherErrors = triggerErrors.get(index) ?? {};
          triggerErrors.set(index, {
            ...otherErrors,
            alertThreshold:
              criticalTrigger.thresholdType === AlertRuleThresholdType.BELOW
                ? t('Warning alert threshold must be greater than critical alert')
                : t('Warning alert threshold must be less than critical alert'),
          });
        });
      }
    }

    return triggerErrors;
  }

  handleFieldChange = (name: string, value: unknown) => {
    if (['timeWindow', 'aggregation'].includes(name)) {
      this.setState({[name]: value});
    }
  };

  handleFilterUpdate = query => {
    this.setState({query});
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

    const {organization, params, rule, onSubmitSuccess} = this.props;
    const {ruleId} = this.props.params;

    // form model has all form state data, however we use local state to keep
    // track of the list of triggers (and actions within triggers)
    try {
      addLoadingMessage();
      const resp = await addOrUpdateRule(this.api, organization.slug, params.projectId, {
        ...rule,
        ...model.getTransformedData(),
        triggers: this.state.triggers.map(sanitizeTrigger),
      });
      addSuccessMessage(ruleId ? t('Updated alert rule') : t('Created alert rule'));
      if (onSubmitSuccess) {
        onSubmitSuccess(resp, model);
      }
    } catch (err) {
      addErrorMessage(
        t(
          'Unable to save alert%s',
          err?.responseJSON?.nonFieldErrors
            ? `: ${err.responseJSON.nonFieldErrors.join(', ')}`
            : ''
        )
      );
    }
  };

  /**
   * Add a new trigger
   */
  handleAddTrigger = () => {
    this.setState(({triggers}) => ({
      triggers: [...triggers, {...createDefaultTrigger(), label: 'warning'}],
    }));
  };

  /**
   * Callback for when triggers change
   *
   * Re-validate triggers on every change and reset indicators when no errors
   */
  handleChangeTriggers = (
    triggers: Trigger[],
    triggerIndex?: number,
    changeObj?: Partial<Trigger>
  ) => {
    this.setState(state => {
      let triggerErrors = state.triggerErrors;

      const newTriggerErrors = this.validateTriggers(triggers, triggerIndex, changeObj);
      triggerErrors = newTriggerErrors;

      if (Array.from(newTriggerErrors).length === 0) {
        clearIndicators();
      }

      return {triggers, triggerErrors};
    });
  };

  handleDeleteRule = async () => {
    const {params} = this.props;
    const {orgId, projectId, ruleId} = params;

    try {
      await this.api.requestPromise(
        `/projects/${orgId}/${projectId}/alert-rules/${ruleId}/`,
        {
          method: 'DELETE',
        }
      );
      this.goBack();
    } catch (_err) {
      addErrorMessage(t('Error deleting rule'));
    }
  };

  handleCancel = () => {
    this.goBack();
  };

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {organization, ruleId, rule, params, onSubmitSuccess} = this.props;
    const {query, aggregation, timeWindow, triggers} = this.state;

    const queryAndAlwaysErrorEvents = !query.includes('event.type')
      ? `${query} ${this.getEventType()}`.trim()
      : query;

    return (
      <Access access={['project:write']}>
        {({hasAccess}) => (
          <Form
            apiMethod={ruleId ? 'PUT' : 'POST'}
            apiEndpoint={`/organizations/${organization.slug}/alert-rules/${
              ruleId ? `${ruleId}/` : ''
            }`}
            submitDisabled={!hasAccess}
            initialData={{
              name: rule.name || '',
              aggregation: rule.aggregation,
              query: rule.query || '',
              timeWindow: rule.timeWindow,
              environment: rule.environment || [],
            }}
            saveOnBlur={false}
            onSubmit={this.handleSubmit}
            onSubmitSuccess={onSubmitSuccess}
            onCancel={this.handleCancel}
            onFieldChange={this.handleFieldChange}
            extraButton={
              !!rule.id ? (
                <Confirm
                  disabled={!hasAccess}
                  message={t('Are you sure you want to delete this alert rule?')}
                  header={t('Delete Alert Rule?')}
                  priority="danger"
                  confirmText={t('Delete Rule')}
                  onConfirm={this.handleDeleteRule}
                >
                  <Button type="button" priority="danger">
                    {t('Delete Rule')}
                  </Button>
                </Confirm>
              ) : null
            }
            submitLabel={t('Save Rule')}
          >
            <TriggersChart
              api={this.api}
              organization={organization}
              projects={this.state.projects}
              triggers={triggers}
              query={queryAndAlwaysErrorEvents}
              aggregation={aggregation}
              timeWindow={timeWindow}
            />

            <RuleConditionsForm
              api={this.api}
              projectSlug={params.projectId}
              organization={organization}
              disabled={!hasAccess}
              onFilterUpdate={this.handleFilterUpdate}
            />

            <Triggers
              disabled={!hasAccess}
              projects={this.state.projects}
              errors={this.state.triggerErrors}
              triggers={triggers}
              currentProject={params.projectId}
              organization={organization}
              ruleId={ruleId}
              availableActions={this.state.availableActions}
              onChange={this.handleChangeTriggers}
              onAdd={this.handleAddTrigger}
            />

            <RuleNameForm disabled={!hasAccess} />
          </Form>
        )}
      </Access>
    );
  }
}

export {RuleFormContainer};
export default withProject(RuleFormContainer);

/**
 * We need a default value of empty string for resolveThreshold or else React complains
 * so we also need to remove it if we do not have a value. Note `0` is a valid value.
 */
function sanitizeTrigger({resolveThreshold, ...trigger}: Trigger): Trigger {
  return {
    ...trigger,
    resolveThreshold:
      defined(resolveThreshold) && resolveThreshold !== '' ? resolveThreshold : null,
  };
}
