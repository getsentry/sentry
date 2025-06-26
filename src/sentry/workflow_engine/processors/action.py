import logging
from collections import defaultdict
from datetime import datetime, timedelta

from django.db import models
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
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    Workflow,
    WorkflowActionGroupStatus,
)
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import WorkflowEventData

logger = logging.getLogger(__name__)

EnqueuedAction = tuple[DataConditionGroup, list[DataCondition]]


def get_workflow_action_group_statuses(
    action_to_workflows_ids: dict[int, set[int]], group: Group, workflow_ids: set[int]
) -> dict[int, list[WorkflowActionGroupStatus]]:
    """
    Returns a mapping of action IDs to their corresponding WorkflowActionGroupStatus objects
    given the provided action_to_workflows_ids and group.
    """

    all_statuses = WorkflowActionGroupStatus.objects.filter(
        group=group, action_id__in=action_to_workflows_ids.keys(), workflow_id__in=workflow_ids
    )

    actions_with_statuses: dict[int, list[WorkflowActionGroupStatus]] = defaultdict(list)

    for status in all_statuses:
        workflow_id = status.workflow_id
        action_id = status.action_id
        if workflow_id not in action_to_workflows_ids[action_id]:
            # if the (workflow, action) combination shouldn't be processed, skip it
            # more difficult to query than to iterate
            continue

        actions_with_statuses[action_id].append(status)

    return actions_with_statuses


def process_workflow_action_group_statuses(
    action_to_workflows_ids: dict[int, set[int]],
    action_to_statuses: dict[int, list[WorkflowActionGroupStatus]],
    workflows: BaseQuerySet[Workflow],
    group: Group,
    now: datetime,
) -> tuple[dict[int, int], set[int], list[WorkflowActionGroupStatus]]:
    """
    Determine which workflow actions should be fired based on their statuses.
    Prepare the statuses to update and create.
    """

    action_to_workflow_ids: dict[int, int] = {}  # will dedupe because there can be only 1
    workflow_frequencies = {
        workflow.id: workflow.config.get("frequency", 0) * timedelta(minutes=1)
        for workflow in workflows
    }
    statuses_to_update: set[int] = set()

    for action_id, statuses in action_to_statuses.items():
        for status in statuses:
            if (now - status.date_updated) > workflow_frequencies.get(status.workflow_id, 0):
                # we should fire the workflow for this action
                action_to_workflow_ids[action_id] = status.workflow_id
                statuses_to_update.add(status.id)

    missing_statuses: list[WorkflowActionGroupStatus] = []
    for action_id, expected_workflows in action_to_workflows_ids.items():
        wags = action_to_statuses.get(action_id, [])
        actual_workflows = {status.workflow_id for status in wags}
        missing_workflows = expected_workflows - actual_workflows

        for workflow_id in missing_workflows:
            # create a new status for the missing workflow
            missing_statuses.append(
                WorkflowActionGroupStatus(
                    workflow_id=workflow_id, action_id=action_id, group=group, date_updated=now
                )
            )
            action_to_workflow_ids[action_id] = workflow_id

    return action_to_workflow_ids, statuses_to_update, missing_statuses


def update_workflow_action_group_statuses(
    now: datetime, statuses_to_update: set[int], missing_statuses: list[WorkflowActionGroupStatus]
) -> None:
    WorkflowActionGroupStatus.objects.filter(
        id__in=statuses_to_update, date_updated__lt=now
    ).update(date_updated=now)

    WorkflowActionGroupStatus.objects.bulk_create(
        missing_statuses,
        batch_size=1000,
        ignore_conflicts=True,
    )


def filter_recently_fired_workflow_actions(
    filtered_action_groups: set[DataConditionGroup], event_data: WorkflowEventData
) -> BaseQuerySet[Action]:
    """
    Returns actions associated with the provided DataConditionsGroups, excluding those that have been recently fired. Also updates associated WorkflowActionGroupStatus objects.
    """

    data_condition_group_actions = DataConditionGroupAction.objects.filter(
        condition_group__in=filtered_action_groups
    ).values_list("action_id", "condition_group__workflowdataconditiongroup__workflow_id")

    action_to_workflows_ids: dict[int, set[int]] = defaultdict(set)
    workflow_ids: set[int] = set()

    for action_id, workflow_id in data_condition_group_actions:
        action_to_workflows_ids[action_id].add(workflow_id)
        workflow_ids.add(workflow_id)

    workflows = Workflow.objects.filter(id__in=workflow_ids)

    action_to_statuses = get_workflow_action_group_statuses(
        action_to_workflows_ids=action_to_workflows_ids,
        group=event_data.event.group,
        workflow_ids=workflow_ids,
    )
    now = timezone.now()
    action_to_workflow_ids, statuses_to_update, missing_statuses = (
        process_workflow_action_group_statuses(
            action_to_workflows_ids=action_to_workflows_ids,
            action_to_statuses=action_to_statuses,
            workflows=workflows,
            group=event_data.event.group,
            now=now,
        )
    )
    update_workflow_action_group_statuses(now, statuses_to_update, missing_statuses)

    return Action.objects.filter(id__in=list(action_to_workflow_ids.keys())).annotate(
        workflow_id=models.F(
            "dataconditiongroupaction__condition_group__workflowdataconditiongroup__workflow__id"
        )
    )


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
