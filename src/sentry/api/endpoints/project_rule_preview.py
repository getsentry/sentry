from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.rule import RuleSetSerializer
from sentry.rules.history.preview import preview
from sentry.web.decorators import transaction_start


@region_silo_endpoint
class ProjectRulePreviewEndpoint(ProjectEndpoint):
    private = True
    permission_classes = (ProjectAlertRulePermission,)

    # a post endpoint because it's too hard to pass a list of objects from the frontend
    @transaction_start("ProjectRulePreviewEndpoint")
    def post(self, request: Request, project) -> Response:
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
            context={"project": project, "organization": project.organization}, data=request.data
        )

        if not serializer.is_valid():
            raise ValidationError

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
            raise ValidationError

        response = self.paginate(
            request=request,
            queryset=results,
            order_by="-id",
            on_results=lambda x: serialize(x, request.user),
            count_hits=True,
        )
        return response
