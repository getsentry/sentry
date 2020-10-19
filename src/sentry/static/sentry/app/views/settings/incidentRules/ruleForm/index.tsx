import {PlainRoute} from 'react-router/lib/Route';
import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Organization, Project} from 'app/types';
import FormModel from 'app/views/settings/components/forms/model';
import {defined} from 'app/utils';
import {trackAnalyticsEvent} from 'app/utils/analytics';
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
import withProject from 'app/utils/withProject';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';

import {
  AlertRuleThresholdType,
  IncidentRule,
  MetricActionTemplate,
  Trigger,
  Dataset,
  UnsavedIncidentRule,
} from '../types';
import {addOrUpdateRule} from '../actions';
import {createDefaultTrigger, DATASET_EVENT_TYPE_FILTERS} from '../constants';
import RuleConditionsForm from '../ruleConditionsForm';

const POLLING_MAX_TIME_LIMIT = 3 * 60000;

type RuleTaskResponse = {
  status: 'pending' | 'failed' | 'success';
  alertRule?: IncidentRule;
  error?: string;
};

type Props = {
  organization: Organization;
  project: Project;
  routes: PlainRoute[];
  rule: IncidentRule;
  ruleId?: string;
  sessionId?: string;
} & RouteComponentProps<{orgId: string; projectId: string; ruleId?: string}, {}> & {
    onSubmitSuccess?: Form['props']['onSubmitSuccess'];
  } & AsyncComponent['props'];

type State = {
  triggers: Trigger[];
  resolveThreshold: UnsavedIncidentRule['resolveThreshold'];
  thresholdType: UnsavedIncidentRule['thresholdType'];
  projects: Project[];
  triggerErrors: Map<number, {[fieldName: string]: string}>;

  // `null` means loading
  availableActions: MetricActionTemplate[] | null;

  // Rule conditions form inputs
  // Needed for TriggersChart
  dataset: Dataset;
  query: string;
  aggregate: string;
  timeWindow: number;
  environment: string | null;
  uuid?: string;
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
    const triggersClone = [...rule.triggers];

    // Warning trigger is removed if it is blank when saving
    if (triggersClone.length !== 2) {
      triggersClone.push(createDefaultTrigger('warning'));
    }

    return {
      ...super.getDefaultState(),

      dataset: rule.dataset,
      aggregate: rule.aggregate,
      query: rule.query || '',
      timeWindow: rule.timeWindow,
      environment: rule.environment || null,
      triggerErrors: new Map(),
      availableActions: null,
      triggers: triggersClone,
      resolveThreshold: rule.resolveThreshold,
      thresholdType: rule.thresholdType,
      projects: [this.props.project],
    };
  }

  getEndpoints(): [string, string][] {
    const {orgId} = this.props.params;

    // TODO(incidents): This is temporary until new API endpoints
    // We should be able to just fetch the rule if rule.id exists

    return [
      ['availableActions', `/organizations/${orgId}/alert-rules/available-actions/`],
    ];
  }

  get eventTypeFilter() {
    return DATASET_EVENT_TYPE_FILTERS[this.state.dataset ?? Dataset.ERRORS];
  }

  goBack() {
    const {router} = this.props;
    const {orgId} = this.props.params;

    router.push(`/organizations/${orgId}/alerts/rules/`);
  }

  resetPollingState = () => {
    this.setState({loading: false, uuid: undefined});
  };

  fetchStatus(model: FormModel) {
    // pollHandler calls itself until it gets either a success
    // or failed status but we don't want to poll forever so we pass
    // in a hard stop time of 3 minutes before we bail.
    const quitTime = Date.now() + POLLING_MAX_TIME_LIMIT;
    setTimeout(() => {
      this.pollHandler(model, quitTime);
    }, 1000);
  }

  pollHandler = async (model: FormModel, quitTime: number) => {
    if (Date.now() > quitTime) {
      addErrorMessage(t('Looking for that channel took too long :('));
      this.resetPollingState();
      return;
    }

    const {
      organization,
      project,
      onSubmitSuccess,
      params: {ruleId},
    } = this.props;
    const {uuid} = this.state;

    try {
      const response: RuleTaskResponse = await this.api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/alert-rule-task/${uuid}/`
      );

      const {status, alertRule, error} = response;

      if (status === 'pending') {
        setTimeout(() => {
          this.pollHandler(model, quitTime);
        }, 1000);
        return;
      }

      this.resetPollingState();

      if (status === 'failed') {
        addErrorMessage(error);
      }
      if (alertRule) {
        addSuccessMessage(ruleId ? t('Updated alert rule') : t('Created alert rule'));
        if (onSubmitSuccess) {
          onSubmitSuccess(alertRule, model);
        }
      }
    } catch {
      addErrorMessage(t('An error occurred'));
      this.resetPollingState();
    }
  };

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
    resolveThreshold: number | '' | null
  ): boolean => {
    const {alertThreshold} = trigger;
    const {thresholdType} = this.state;

    // If value and/or other value is empty
    // then there are no checks to perform against
    if (!hasThresholdValue(alertThreshold) || !hasThresholdValue(resolveThreshold)) {
      return true;
    }

    // If this is alert threshold and not inverted, it can't be below resolve
    // If this is alert threshold and inverted, it can't be above resolve
    // If this is resolve threshold and not inverted, it can't be above resolve
    // If this is resolve threshold and inverted, it can't be below resolve
    // Since we're comparing non-inclusive thresholds here (>, <), we need
    // to modify the values when we compare. An example of why:
    // Alert > 0, resolve < 1. This means that we want to alert on values
    // of 1 or more, and resolve on values of 0 or less. This is valid, but
    // without modifying the values, this boundary case will fail.
    const isValid =
      thresholdType === AlertRuleThresholdType.BELOW
        ? alertThreshold - 1 <= resolveThreshold + 1
        : alertThreshold + 1 >= resolveThreshold - 1;

    const otherErrors = errors.get(triggerIndex) || {};

    if (isValid) {
      return true;
    }

    // Not valid... let's figure out an error message
    const isBelow = thresholdType === AlertRuleThresholdType.BELOW;
    let errorMessage = '';

    if (typeof resolveThreshold !== 'number') {
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
      alertThreshold: errorMessage,
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
    thresholdType = this.state.thresholdType,
    resolveThreshold = this.state.resolveThreshold,
    changedTriggerIndex?: number
  ) {
    const triggerErrors = new Map();

    const requiredFields = ['label', 'alertThreshold'];
    triggers.forEach((trigger, triggerIndex) => {
      requiredFields.forEach(field => {
        // check required fields
        this.validateFieldInTrigger({
          errors: triggerErrors,
          triggerIndex,
          isValid: (): boolean => {
            if (trigger.label === 'critical') {
              return !isEmpty(trigger[field]);
            }

            // If warning trigger has actions, it must have a value
            return trigger.actions.length === 0 || !isEmpty(trigger[field]);
          },
          field,
          message: t('Field is required'),
        });
      });

      // Check thresholds
      this.isValidTrigger(
        changedTriggerIndex ?? triggerIndex,
        trigger,
        triggerErrors,
        resolveThreshold
      );
    });

    // If we have 2 triggers, we need to make sure that the critical and warning
    // alert thresholds are valid (e.g. if critical is above x, warning must be less than x)
    const criticalTriggerIndex = triggers.findIndex(({label}) => label === 'critical');
    const warningTriggerIndex = criticalTriggerIndex ^ 1;
    const criticalTrigger = triggers[criticalTriggerIndex];
    const warningTrigger = triggers[warningTriggerIndex];

    const isEmptyWarningThreshold = isEmpty(warningTrigger.alertThreshold);
    const warningThreshold = warningTrigger.alertThreshold ?? 0;
    const criticalThreshold = criticalTrigger.alertThreshold ?? 0;

    const hasError =
      thresholdType === AlertRuleThresholdType.ABOVE
        ? warningThreshold > criticalThreshold
        : warningThreshold < criticalThreshold;

    if (hasError && !isEmptyWarningThreshold) {
      [criticalTriggerIndex, warningTriggerIndex].forEach(index => {
        const otherErrors = triggerErrors.get(index) ?? {};
        triggerErrors.set(index, {
          ...otherErrors,
          alertThreshold:
            thresholdType === AlertRuleThresholdType.BELOW
              ? t('Warning threshold must be greater than critical alert')
              : t('Warning threshold must be less than critical alert'),
        });
      });
    }

    return triggerErrors;
  }

  handleFieldChange = (name: string, value: unknown) => {
    if (['dataset', 'timeWindow', 'environment', 'aggregate'].includes(name)) {
      this.setState({[name]: value});
    }
  };

  // We handle the filter update outside of the fieldChange handler since we
  // don't want to update the filter on every input change, just on blurs and
  // searches.
  handleFilterUpdate = (query: string) => {
    const {organization, sessionId} = this.props;

    trackAnalyticsEvent({
      eventKey: 'alert_builder.filter',
      eventName: 'Alert Builder: Filter',
      query,
      organization_id: organization.id,
      session_id: sessionId,
    });

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

    const {organization, params, rule, onSubmitSuccess, location, sessionId} = this.props;
    const {ruleId} = this.props.params;
    const {resolveThreshold, triggers, thresholdType, uuid} = this.state;

    // Remove empty warning trigger
    const sanitizedTriggers = triggers.filter(
      trigger => trigger.label !== 'warning' || !isEmpty(trigger.alertThreshold)
    );

    // form model has all form state data, however we use local state to keep
    // track of the list of triggers (and actions within triggers)
    try {
      addLoadingMessage();
      const [resp, , xhr] = await addOrUpdateRule(
        this.api,
        organization.slug,
        params.projectId,
        {
          ...rule,
          ...model.getTransformedData(),
          triggers: sanitizedTriggers,
          resolveThreshold: isEmpty(resolveThreshold) ? null : resolveThreshold,
          thresholdType,
        },
        {
          referrer: location?.query?.referrer,
          sessionId,
        }
      );
      // if we get a 202 back it means that we have an async task
      // running to lookup and verify the channel id for Slack.
      if (xhr && xhr.status === 202 && !uuid) {
        this.setState({loading: true, uuid: resp.uuid});
        this.fetchStatus(model);
        addLoadingMessage(t('Looking through all your channels...'));
      } else {
        addSuccessMessage(ruleId ? t('Updated alert rule') : t('Created alert rule'));
        if (onSubmitSuccess) {
          onSubmitSuccess(resp, model);
        }
      }
    } catch (err) {
      const errors = err?.responseJSON
        ? Array.isArray(err?.responseJSON)
          ? err?.responseJSON
          : Object.values(err?.responseJSON)
        : [];
      const apiErrors = errors.length > 0 ? `: ${errors.join(', ')}` : '';
      addErrorMessage(t('Unable to save alert%s', apiErrors));
    }
  };

  /**
   * Callback for when triggers change
   *
   * Re-validate triggers on every change and reset indicators when no errors
   */
  handleChangeTriggers = (triggers: Trigger[], triggerIndex?: number) => {
    this.setState(state => {
      let triggerErrors = state.triggerErrors;

      const newTriggerErrors = this.validateTriggers(
        triggers,
        state.thresholdType,
        state.resolveThreshold,
        triggerIndex
      );
      triggerErrors = newTriggerErrors;

      if (Array.from(newTriggerErrors).length === 0) {
        clearIndicators();
      }

      return {triggers, triggerErrors};
    });
  };

  handleThresholdTypeChange = (thresholdType: AlertRuleThresholdType) => {
    const {triggers} = this.state;

    const triggerErrors = this.validateTriggers(triggers, thresholdType);
    this.setState(state => ({
      thresholdType,
      triggerErrors: new Map([...triggerErrors, ...state.triggerErrors]),
    }));
  };

  handleResolveThresholdChange = (
    resolveThreshold: UnsavedIncidentRule['resolveThreshold']
  ) => {
    const {triggers} = this.state;

    const triggerErrors = this.validateTriggers(triggers, undefined, resolveThreshold);
    this.setState(state => ({
      resolveThreshold,
      triggerErrors: new Map([...triggerErrors, ...state.triggerErrors]),
    }));
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
    const {
      query,
      timeWindow,
      triggers,
      aggregate,
      environment,
      thresholdType,
      resolveThreshold,
    } = this.state;

    const queryWithTypeFilter = `${query} ${this.eventTypeFilter}`.trim();

    const chart = (
      <TriggersChart
        organization={organization}
        projects={this.state.projects}
        triggers={triggers}
        query={queryWithTypeFilter}
        aggregate={aggregate}
        timeWindow={timeWindow}
        environment={environment}
        resolveThreshold={resolveThreshold}
        thresholdType={thresholdType}
      />
    );

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
              dataset: rule.dataset,
              aggregate: rule.aggregate,
              query: rule.query || '',
              timeWindow: rule.timeWindow,
              environment: rule.environment || null,
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
            <RuleConditionsForm
              api={this.api}
              projectSlug={params.projectId}
              organization={organization}
              disabled={!hasAccess}
              thresholdChart={chart}
              onFilterSearch={this.handleFilterUpdate}
            />

            <Triggers
              disabled={!hasAccess}
              projects={this.state.projects}
              errors={this.state.triggerErrors}
              triggers={triggers}
              resolveThreshold={resolveThreshold}
              thresholdType={thresholdType}
              currentProject={params.projectId}
              organization={organization}
              ruleId={ruleId}
              availableActions={this.state.availableActions}
              onChange={this.handleChangeTriggers}
              onThresholdTypeChange={this.handleThresholdTypeChange}
              onResolveThresholdChange={this.handleResolveThresholdChange}
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
