from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.rule import RuleSetSerializer
from sentry.rules.history.endpoints.project_rule_stats import TimeSeriesValueSerializer
from sentry.rules.history.preview import preview
from sentry.web.decorators import transaction_start


@region_silo_endpoint
class ProjectRulePreviewEndpoint(ProjectEndpoint):
    private = True
    permission_classes = (ProjectAlertRulePermission,)

    @transaction_start("ProjectRulePreviewEndpoint")
    def get(self, request: Request, project) -> Response:
        """
        Get a list of alert triggers in past 2 weeks for given rules

            {method} {path}
            {{
                "conditions": [],
                "filters": [],
                "actionMatch": "all",
                "filterMatch": "all",
                "frequency": 60,
            }}

        """
        serializer = RuleSetSerializer(
            context={"project": project, "organization": project.organization}, data=request.GET
        )

        if not serializer.is_valid():
            return Response(exception=ValidationError, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        results = preview(
            project,
            data.get("conditions", []),
            data.get("filters", []),
            data.get("actionMatch"),
            data.get("filterMatch"),
            data.get("frequency"),
        )

        if results is None:
            return Response(
                exception=ValidationError,
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(serialize(results, request.user, TimeSeriesValueSerializer()))
