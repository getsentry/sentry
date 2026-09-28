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

        try:
            kwargs["rule"] = Rule.objects.get(
                project=project,
                id=rule_id,
            )
        except Rule.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs


class WorkflowEngineRuleEndpoint(RuleEndpoint):
    # GET and DELETE use Workflow Engine unconditionally. Subclasses may opt
    # other methods in with a per-method flag.
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
            arw = AlertRuleWorkflow.objects.filter(
                rule_id=rule_id,
                workflow__organization=project.organization,
                workflow__status=ObjectStatus.ACTIVE,
                workflow__detectorworkflow__detector__project=project,
            ).first()
            if arw is not None:
                kwargs["rule"] = arw.workflow
            else:
                # XXX: this means the workflow was single written and has no ARW or related Rule object
                workflow_id = get_object_id_from_fake_id(int(rule_id))
                workflow = Workflow.objects.filter(
                    id=workflow_id,
                    organization=project.organization,
                    status=ObjectStatus.ACTIVE,
                    detectorworkflow__detector__project=project,
                ).first()
                if workflow is None:
                    raise ResourceDoesNotExist
                kwargs["rule"] = workflow

            return args, kwargs

        try:
            kwargs["rule"] = Rule.objects.get(project=project, id=rule_id)
        except Rule.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs
