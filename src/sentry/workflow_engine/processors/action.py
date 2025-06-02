import logging
from collections import defaultdict
from datetime import datetime, timedelta

from django.db.models import DurationField, ExpressionWrapper, F, IntegerField, Value
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Coalesce
from django.utils import timezone

from sentry import features
from sentry.constants import ObjectStatus
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.exceptions import NotRegistered
from sentry.integrations.base import IntegrationFeatures
from sentry.integrations.manager import default_manager as integrations_manager
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.plugins.base import plugins
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.rules.actions.services import PluginService
from sentry.workflow_engine.models import (
    Action,
    ActionGroupStatus,
    DataCondition,
    DataConditionGroup,
    WorkflowDataConditionGroup,
    WorkflowFireHistory,
)
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import WorkflowEventData

logger = logging.getLogger(__name__)

EnqueuedAction = tuple[DataConditionGroup, list[DataCondition]]


def get_action_last_updated_statuses(now: datetime, actions: BaseQuerySet[Action], group: Group):
    # Annotate the actions with the amount of time since the last update
    statuses = ActionGroupStatus.objects.filter(group=group, action__in=actions)

    check_workflow_frequency = Cast(
        Coalesce(
            KeyTextTransform(
                "frequency",
                F(
                    "action__dataconditiongroupaction__condition_group__workflowdataconditiongroup__workflow__config"
                ),
            ),
            Value("0"),  # default 0
        ),
        output_field=IntegerField(),
    )

    frequency_in_minutes = ExpressionWrapper(
        F("frequency") * timedelta(minutes=1),  # convert to timedelta
        output_field=DurationField(),
    )

    time_since_last_update = ExpressionWrapper(
        Value(now) - F("date_updated"), output_field=DurationField()
    )

    statuses = statuses.annotate(
        frequency=check_workflow_frequency,
        frequency_minutes=frequency_in_minutes,
        difference=time_since_last_update,
    )

    return statuses


def create_workflow_fire_histories(
    actions_to_fire: BaseQuerySet[Action], event_data: WorkflowEventData
) -> list[WorkflowFireHistory]:
    # Create WorkflowFireHistory objects for workflows we fire actions for
    workflow_ids = set(
        WorkflowDataConditionGroup.objects.filter(
            condition_group__dataconditiongroupaction__action__in=actions_to_fire
        ).values_list("workflow_id", flat=True)
    )

    fire_histories = [
        WorkflowFireHistory(
            workflow_id=workflow_id,
            group=event_data.event.group,
            event_id=event_data.event.event_id,
        )
        for workflow_id in workflow_ids
    ]
    return WorkflowFireHistory.objects.bulk_create(fire_histories)


# TODO(cathy): only reinforce workflow frequency for certain issue types
def filter_recently_fired_workflow_actions(
    filtered_action_groups: set[DataConditionGroup], event_data: WorkflowEventData
) -> BaseQuerySet[Action]:
    # get the actions for any of the triggered data condition groups
    actions = Action.objects.filter(
        dataconditiongroupaction__condition_group__in=filtered_action_groups
    ).distinct()

    group = event_data.event.group

    now = timezone.now()
    statuses = get_action_last_updated_statuses(now, actions, group)

    actions_without_statuses = actions.exclude(id__in=statuses.values_list("action_id", flat=True))
    actions_to_include = set(
        statuses.filter(difference__gt=F("frequency_minutes")).values_list("action_id", flat=True)
    )

    ActionGroupStatus.objects.filter(
        action__in=actions_to_include, group=group, date_updated__lt=now
    ).order_by("id").update(date_updated=now)
    ActionGroupStatus.objects.bulk_create(
        [
            ActionGroupStatus(action=action, group=group, date_updated=now)
            for action in actions_without_statuses
        ],
        batch_size=1000,
        ignore_conflicts=True,
    )

    actions_without_statuses_ids = {action.id for action in actions_without_statuses}
    filtered_actions = actions.filter(id__in=actions_to_include | actions_without_statuses_ids)

    create_workflow_fire_histories(filtered_actions, event_data)

    return filtered_actions


def get_available_action_integrations_for_org(organization: Organization) -> list[RpcIntegration]:
    providers = [
        handler.provider_slug
        for handler in action_handler_registry.registrations.values()
        if hasattr(handler, "provider_slug")
    ]
    return integration_service.get_integrations(
        status=ObjectStatus.ACTIVE,
        org_integration_status=ObjectStatus.ACTIVE,
        organization_id=organization.id,
        providers=providers,
    )


def get_notification_plugins_for_org(organization: Organization) -> list[PluginService]:
    """
    Get all plugins for an organization.
    This method returns a deduplicated list of plugins that are enabled for an organization.
    """

    projects = Project.objects.filter(organization_id=organization.id)

    # Need to use a map to deduplicate plugins by slug because the same plugin can be enabled for multiple projects
    plugin_map = {}

    for project in projects:
        for plugin in plugins.for_project(project, version=1):
            if not isinstance(plugin, NotificationPlugin):
                continue

            plugin_map[plugin.slug] = PluginService(plugin)

    return list(plugin_map.values())


def get_integration_services(organization_id: int) -> dict[int, list[tuple[int, str]]]:
    """
    Get all Pagerduty services and Opsgenie teams for an organization's integrations.
    """

    org_ints = integration_service.get_organization_integrations(
        organization_id=organization_id,
        providers=[IntegrationProviderSlug.PAGERDUTY, IntegrationProviderSlug.OPSGENIE],
    )

    services: dict[int, list[tuple[int, str]]] = defaultdict(list)

    for org_int in org_ints:
        pagerduty_services = org_int.config.get("pagerduty_services")
        if pagerduty_services:
            services[org_int.integration_id].extend(
                (s["id"], s["service_name"]) for s in pagerduty_services
            )
        opsgenie_teams = org_int.config.get("team_table")
        if opsgenie_teams:
            services[org_int.integration_id].extend(
                (team["id"], team["team"]) for team in opsgenie_teams
            )

    return services


def _get_integration_features(action_type: Action.Type) -> frozenset[IntegrationFeatures]:
    """
    Get the IntegrationFeatures for an integration-based action type.
    """
    assert action_type.is_integration()
    integration_key = action_type.value  # action types should be match integration keys.
    try:
        integration = integrations_manager.get(integration_key)
    except NotRegistered:
        raise ValueError(f"No integration found for action type: {action_type}")
    return integration.features


# The features that are relevent to Action behaviors;
# if the organization doesn't have access to all of the features an integration
# requires that are in this list, the action should not be permitted.
_ACTION_RELEVANT_INTEGRATION_FEATURES = {
    IntegrationFeatures.ISSUE_BASIC,
    IntegrationFeatures.ISSUE_SYNC,
    IntegrationFeatures.TICKET_RULES,
    IntegrationFeatures.ALERT_RULE,
    IntegrationFeatures.ENTERPRISE_ALERT_RULE,
    IntegrationFeatures.ENTERPRISE_INCIDENT_MANAGEMENT,
    IntegrationFeatures.INCIDENT_MANAGEMENT,
}


def is_action_permitted(action_type: Action.Type, organization: Organization) -> bool:
    """
    Check if an action type is permitted for an organization.
    """
    if not action_type.is_integration():
        return True
    integration_features = _get_integration_features(action_type)
    required_org_features = integration_features.intersection(_ACTION_RELEVANT_INTEGRATION_FEATURES)
    feature_names = [
        f"organizations:integrations-{integration_feature}"
        for integration_feature in required_org_features
    ]
    return all(features.has(feature_name, organization) for feature_name in feature_names)
