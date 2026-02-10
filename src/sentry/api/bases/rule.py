from typing import Any

from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.bases import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.rule import Rule
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
