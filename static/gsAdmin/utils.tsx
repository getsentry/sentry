import moment from 'moment-timezone';

import ConfigStore from 'sentry/stores/configStore';

export const prettyDate = (x: moment.MomentInput) => moment(x).format('ll');

export const isBillingAdmin = () => {
  const user = ConfigStore.get('user');
  return !!user?.permissions?.has('billing.admin');
};

type QueryConditions = {
  organizationId?: string;
  projectId?: string;
};

export function getLogQuery(type: string, conditions: QueryConditions) {
  let query = '';
  let fields = '';

  if (type === 'api') {
    query = `resource.type = k8s_container
    resource.labels.namespace_name = default
    resource.labels.container_name = sentry
    labels.name = "sentry.access.api"
    labels."k8s-pod/service" = "getsentry"
    jsonPayload.event != ""`;
    fields = 'jsonPayload/path,jsonPayload/tokenType';
  } else if (type === 'audit') {
    query = `resource.type = k8s_container
    resource.labels.namespace_name = default
    resource.labels.container_name = sentry
    labels."k8s-pod/service" = "getsentry"
    (labels.name = "sentry.audit.api" OR labels.name = "sentry.audit.ui")
    jsonPayload.event != ""`;
    fields = 'jsonPayload/event,jsonPayload/actor_label,jsonPayload/username';
  } else if (type === 'email') {
    query = `resource.type = k8s_container
    resource.labels.namespace_name = default
    resource.labels.container_name = sentry
    labels."k8s-pod/service" = "getsentry"
    jsonPayload.event != ""
    jsonPayload.name = "sentry.mail"`;
    fields = 'jsonPayload/message_to,jsonPayload/message_type,jsonPayload/event';
  } else if (type === 'billing') {
    query = `resource.type = k8s_container
    resource.labels.namespace_name = default
    resource.labels.container_name = sentry
    labels.name = "getsentry.billing"
    labels."k8s-pod/service" = "getsentry"
    jsonPayload.event != ""`;
    fields =
      'jsonPayload/event,jsonPayload/reserved_events,jsonPayload/plan,jsonPayload/ondemand_spend';
  } else if (type === 'auth') {
    query = `resource.type = k8s_container
    resource.labels.namespace_name = default
    resource.labels.container_name = sentry
    labels."k8s-pod/service" = "getsentry"
    labels.name = "sentry.auth"
    jsonPayload.event != ""`;
    fields = 'jsonPayload/event,jsonPayload/username';
  } else if (type === 'project') {
    query = `resource.type = k8s_container
    resource.labels.namespace_name = default
    resource.labels.container_name = sentry
    labels."k8s-pod/service" = "getsentry"
    jsonPayload.event != ""`;
    fields = 'jsonPayload/event';
  } else if (type === 'organization') {
    query = `resource.type = k8s_container
    resource.labels.namespace_name = default
    resource.labels.container_name = sentry
    labels."k8s-pod/service" = "getsentry"
    jsonPayload.event != ""`;
    fields = 'jsonPayload/event';
  } else {
    throw new Error(`Unknown query type of ${query}`);
  }

  if (conditions.organizationId) {
    query += `\njsonPayload.organization_id = ${conditions.organizationId}`;
  }
  if (conditions.projectId) {
    query += `\njsonPayload.project_id = ${conditions.projectId}`;
  }
  const logBase = 'https://console.cloud.google.com/logs/query';
  query = encodeURIComponent(query);
  fields = encodeURIComponent(fields);

  return `${logBase};query=${query};summaryFields=${fields}`;
}
