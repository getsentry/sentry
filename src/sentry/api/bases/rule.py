from typing import Any

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
        use_workflow_engine = features.has(
            "organizations:workflow-engine-rule-serializers", project.organization
        ) or (method_flag is not None and features.has(method_flag, project.organization))
        if use_workflow_engine:
            try:
                arw = AlertRuleWorkflow.objects.get(
                    rule_id=rule_id, workflow__organization=project.organization
                )
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
