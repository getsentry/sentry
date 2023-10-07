from typing import Any, Tuple

from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.bases import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.rule import Rule


class RuleEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    permission_classes = (ProjectAlertRulePermission,)

    def convert_args(
        self, request: Request, rule_id: str, *args: Any, **kwargs: Any
    ) -> Tuple[Any, Any]:
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
