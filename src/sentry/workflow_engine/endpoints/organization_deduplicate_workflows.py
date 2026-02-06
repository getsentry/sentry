from typing import Any

from django.db import IntegrityError, router, transaction
from django.db.models import Prefetch
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.utils import json
from sentry.workflow_engine.models import (
    Action,
    AlertRuleWorkflow,
    DataConditionGroupAction,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import DataCondition
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup


class OrganizationDeduplicateWorkflowsPermission(OrganizationPermission):
    scope_map = {
        "PUT": ["org:write", "org:admin"],
    }


class WorkflowData:
    def __init__(self, workflow: Any):
        self.workflow = workflow

    def serialize(self) -> str:
        # Extract triggers
        trigger_conditions = []
        trigger_group = {}

        if self.workflow.when_condition_group is not None:
            for condition in self.workflow.when_condition_group.prefetched_trigger_conditions:
                trigger_conditions.append(
                    {
                        "type": condition.type,
                        "comparison": condition.comparison,
                        "result": condition.condition_result,
                    }
                )
            # Sort trigger conditions and action groups for consistent hashing
            trigger_conditions.sort(
                key=lambda c: (c["type"], json.dumps(c["comparison"], sort_keys=True))  # type: ignore[arg-type]
            )

            trigger_group = {
                "conditions": trigger_conditions,
                "logic_type": self.workflow.when_condition_group.logic_type,
            }

        # Extract action groups
        action_groups = []
        for wdcg in self.workflow.prefetched_action_groups:
            group_conditions = []
            for condition in wdcg.condition_group.prefetched_conditions:
                group_conditions.append(
                    {
                        "type": condition.type,
                        "comparison": condition.comparison,
                        "result": condition.condition_result,
                    }
                )

            group_actions = []
            for action_data in wdcg.condition_group.prefetched_actions:
                group_actions.append(
                    {
                        "type": action_data.action.type,
                        "config": action_data.action.config,
                    }
                )

            # Sort conditions and actions for consistent hashing
            group_conditions.sort(
                key=lambda c: (c["type"], json.dumps(c["comparison"], sort_keys=True))  # type: ignore[arg-type]
            )
            group_actions.sort(key=lambda a: (a["type"], json.dumps(a["config"], sort_keys=True)))  # type: ignore[arg-type]

            action_groups.append(
                {
                    "conditions": group_conditions,
                    "actions": group_actions,
                    "logic_type": wdcg.condition_group.logic_type,
                }
            )

        action_groups.sort(key=lambda g: json.dumps(g, sort_keys=True))  # type: ignore[arg-type]

        workflow_data = {
            "action_groups": action_groups,
            "config": self.workflow.config,
            "environment_id": self.workflow.environment_id,
            "enabled": self.workflow.enabled,
            "organization_id": self.workflow.organization_id,
            "trigger_group": trigger_group,
        }

        return json.dumps(workflow_data, sort_keys=True)  # type: ignore[arg-type]


def deduplicate_workflows(organization: Organization) -> None:
    workflows = (
        Workflow.objects.filter(organization=organization)
        .select_related("when_condition_group")
        .prefetch_related(
            Prefetch(
                "when_condition_group__conditions",
                queryset=DataCondition.objects.all(),
                to_attr="prefetched_trigger_conditions",
            ),
            Prefetch(
                "workflowdataconditiongroup_set",
                queryset=WorkflowDataConditionGroup.objects.select_related(
                    "condition_group"
                ).prefetch_related(
                    Prefetch(
                        "condition_group__conditions",
                        queryset=DataCondition.objects.all(),
                        to_attr="prefetched_conditions",
                    ),
                    Prefetch(
                        "condition_group__dataconditiongroupaction_set",
                        queryset=DataConditionGroupAction.objects.select_related("action"),
                        to_attr="prefetched_actions",
                    ),
                ),
                to_attr="prefetched_action_groups",
            ),
            # Used to update alert rule <> workflow connections in legacy models
            Prefetch(
                "alertruleworkflow_set",
                queryset=AlertRuleWorkflow.objects.all(),
                to_attr="prefetched_rule_workflows",
            ),
        )
        .distinct()
    )
    workflow_dedupe_hash: dict[str, list[int]] = {}

    for workflow in workflows:
        workflow_data = WorkflowData(workflow)
        workflow_hash = workflow_data.serialize()

        if workflow_hash in workflow_dedupe_hash:
            workflow_dedupe_hash[workflow_hash].append(workflow.id)
        else:
            workflow_dedupe_hash[workflow_hash] = [workflow.id]

    for workflow_hash, workflow_ids in workflow_dedupe_hash.items():
        # The workflow is not duplicated in the org, continue
        if len(workflow_ids) <= 1:
            continue

        canonical_workflow_id = workflow_ids.pop()

        with transaction.atomic(router.db_for_write(Workflow)):
            try:
                # Update the DetectorWorkflow references to use the canonical version
                DetectorWorkflow.objects.filter(workflow_id__in=workflow_ids).update(
                    workflow_id=canonical_workflow_id
                )

                # Update AlertRuleWorkflow entries to point to the canonical workflow
                AlertRuleWorkflow.objects.filter(workflow_id__in=workflow_ids).update(
                    workflow_id=canonical_workflow_id
                )
            except IntegrityError:
                # the DetectorWorkflow or AlertRuleWorkflow connections that we're attempting to create
                # already exist. We should just continue with the rest of the process for this workflow.
                pass

        with transaction.atomic(router.db_for_write(Workflow)):
            # Before deleting workflows, clean up related models that won't be cascade deleted
            # Also deletes DataConditionGroupAction
            Action.objects.filter(
                dataconditiongroupaction__condition_group__workflowdataconditiongroup__workflow_id__in=workflow_ids
            ).delete()

            # Also deletes WorkflowDataConditionGroup
            DataConditionGroup.objects.filter(
                workflowdataconditiongroup__workflow_id__in=workflow_ids
            ).delete()

            # Now delete the duplicate workflows
            Workflow.objects.filter(id__in=workflow_ids).delete()


@region_silo_endpoint
class OrganizationDeduplicateWorkflowsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationDeduplicateWorkflowsPermission,)
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES

    def put(self, request: Request, organization: Organization) -> Response:
        deduplicate_workflows(organization)
        return Response("Successfully deduplicated workflows.")
