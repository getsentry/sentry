import logging
from collections.abc import Iterable

from sentry.models.project import Project
from sentry.notifications.types import NotificationOrigin
from sentry.notifications.utils.links import create_link_to_workflow
from sentry.utils.http import absolute_uri
from sentry.workflow_engine.models import AlertRuleWorkflow, Workflow

logger = logging.getLogger(__name__)


def get_notification_origins(
    project: Project,
    *,
    workflow_ids: Iterable[int] = (),
    legacy_rule_ids: Iterable[int] = (),
) -> list[NotificationOrigin]:
    """Resolve callback IDs to workflow-backed notification origins.

    Workflow IDs are authoritative. Legacy rule IDs are accepted for compatibility
    and mapped through AlertRuleWorkflow. IDs without a workflow in the project's
    organization are omitted.
    """
    workflow_ids = list(dict.fromkeys(workflow_ids))
    legacy_rule_ids = list(dict.fromkeys(legacy_rule_ids))

    links = list(
        AlertRuleWorkflow.objects.filter(workflow_id__in=workflow_ids, rule_id__isnull=False)
    )
    linked_workflow_ids = {link.workflow_id for link in links}
    links.extend(
        AlertRuleWorkflow.objects.filter(rule_id__in=legacy_rule_ids).exclude(
            workflow_id__in=linked_workflow_ids
        )
    )
    rule_id_by_workflow_id = {link.workflow_id: link.rule_id for link in links}
    workflow_id_by_rule_id = {
        link.rule_id: link.workflow_id for link in links if link.rule_id is not None
    }

    all_workflow_ids = {*workflow_ids, *workflow_id_by_rule_id.values()}
    workflows = Workflow.objects.filter(organization_id=project.organization_id).in_bulk(
        all_workflow_ids
    )

    origins = []
    seen_workflow_ids = set()
    for workflow_id in workflow_ids:
        workflow = workflows.get(workflow_id)
        if workflow is None:
            continue
        seen_workflow_ids.add(workflow_id)
        origins.append(
            NotificationOrigin(
                label=workflow.name,
                environment_id=workflow.environment_id,
                workflow_id=workflow_id,
                legacy_rule_id=rule_id_by_workflow_id.get(workflow_id),
            )
        )

    for legacy_rule_id in legacy_rule_ids:
        linked_workflow_id = workflow_id_by_rule_id.get(legacy_rule_id)
        if linked_workflow_id is None or linked_workflow_id in seen_workflow_ids:
            continue
        workflow = workflows.get(linked_workflow_id)
        if workflow is None:
            continue
        seen_workflow_ids.add(linked_workflow_id)
        origins.append(
            NotificationOrigin(
                label=workflow.name,
                environment_id=workflow.environment_id,
                workflow_id=linked_workflow_id,
                legacy_rule_id=legacy_rule_id,
            )
        )

    return origins


def get_workflow_url(origin: NotificationOrigin, organization_slug: str) -> str | None:
    if origin.workflow_id is not None:
        return absolute_uri(create_link_to_workflow(organization_slug, str(origin.workflow_id)))

    logger.warning(
        "notifications.workflow_url.missing_workflow_id",
        extra={"legacy_rule_id": origin.legacy_rule_id},
    )
    return None
