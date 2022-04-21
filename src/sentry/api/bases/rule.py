from typing import Any, Tuple

from rest_framework.request import Request

from sentry.api.bases import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Rule, RuleStatus


class RuleEndpoint(ProjectEndpoint):  # type: ignore
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
                project=project, id=rule_id, status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE]
            )
        except Rule.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs
