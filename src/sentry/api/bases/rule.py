from typing import Any

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.request import Request

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.bases import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.constants import ObjectStatus
from sentry.incidents.endpoints.serializers.utils import get_object_id_from_fake_id
from sentry.models.rule import Rule
from sentry.workflow_engine.models.alertrule_workflow import AlertRuleWorkflow
from sentry.workflow_engine.models.workflow import Workflow
from sentry.workflow_engine.utils.legacy_metric_tracking import report_used_legacy_models


class SharedWorkflowError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = (
        "This rule's workflow is shared with other rules. Use the workflow API to manage it."
    )

    def __init__(self, workflow_id: int) -> None:
        detail = (
            f"Workflow {workflow_id} is shared with other rules. Use the workflow API to manage it."
        )
        super().__init__(detail=detail)


class RuleEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    permission_classes = (ProjectAlertRulePermission,)

    def convert_args(
        self, request: Request, rule_id: str, *args: Any, **kwargs: Any
    ) -> tuple[Any, Any]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        project = kwargs["project"]

        if not rule_id.isdigit():
            raise ResourceDoesNotExist

        # Mark that we're using legacy Rule models (before query to track failures too)
        report_used_legacy_models()

        try:
            kwargs["rule"] = Rule.objects.get(
                project=project,
                id=rule_id,
            )
        except Rule.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs


class WorkflowEngineRuleEndpoint(RuleEndpoint):
    # Subclasses may set a per-method granular flag (e.g. for GET) that is OR'd
    # with the broad workflow-engine-rule-serializers flag.
    workflow_engine_method_flags: dict[str, str] = {}

    def convert_args(
        self, request: Request, rule_id: str, *args: Any, **kwargs: Any
    ) -> tuple[Any, Any]:
        args, kwargs = super(RuleEndpoint, self).convert_args(request, *args, **kwargs)
        project = kwargs["project"]

        if not rule_id.isdigit():
            raise ResourceDoesNotExist

        method_flag = self.workflow_engine_method_flags.get(request.method or "")
        use_workflow_engine = request.method in ("GET", "DELETE") or (
            method_flag is not None and features.has(method_flag, project.organization)
        )
        if use_workflow_engine:
            try:
                arw = AlertRuleWorkflow.objects.get(
                    rule_id=rule_id,
                    workflow__organization=project.organization,
                    workflow__status=ObjectStatus.ACTIVE,
                )
                # For mutating requests via a legacy Rule ID, reject if the
                # Workflow is shared with other Rules or AlertRules.
                if request.method in ("PUT", "DELETE"):
                    has_other_links = (
                        AlertRuleWorkflow.objects.filter(workflow_id=arw.workflow_id)
                        .exclude(id=arw.id)
                        .exists()
                    )
                    if has_other_links:
                        raise SharedWorkflowError(arw.workflow_id)
                kwargs["rule"] = arw.workflow
            except AlertRuleWorkflow.DoesNotExist:
                # XXX: this means the workflow was single written and has no ARW or related Rule object
                try:
                    workflow_id = get_object_id_from_fake_id(int(rule_id))
                    kwargs["rule"] = Workflow.objects.get(
                        id=workflow_id,
                        organization=project.organization,
                        status=ObjectStatus.ACTIVE,
                    )
                except (AlertRuleWorkflow.DoesNotExist, Workflow.DoesNotExist):
                    raise ResourceDoesNotExist

            return args, kwargs

        report_used_legacy_models()
        try:
            kwargs["rule"] = Rule.objects.get(project=project, id=rule_id)
        except Rule.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs
