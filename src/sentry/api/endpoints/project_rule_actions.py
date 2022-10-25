from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers.rest_framework import RuleActionSerializer
from sentry.models import Rule
from sentry.rules.processor import RuleProcessor
from sentry.utils.safe import safe_execute
from sentry.utils.samples import create_sample_event
from sentry.web.decorators import transaction_start


@region_silo_endpoint
class ProjectRuleActionsEndpoint(ProjectEndpoint):
    private = True
    permission_classes = (ProjectAlertRulePermission,)

    @transaction_start("ProjectRuleActionsEndpoint")
    def post(self, request: Request, project) -> Response:
        """
        Activate a rule's downstream actions using the data from a previous event

            {method} {path}
            {{
                "actions": []
            }}

        """
        serializer = RuleActionSerializer(
            context={"project": project, "organization": project.organization}, data=request.data
        )

        if not serializer.is_valid():
            raise ValidationError

        data = serializer.validated_data
        if len(data.get("actions", [])) == 0:
            raise ValidationError

        data["conditions"] = []
        data["filters"] = []
        data["actionMatch"] = "all"
        data["filterMatch"] = "all"
        data["frequency"] = 30
        rule = Rule(id=-1, project=project, data=data)

        test_event = create_sample_event(
            project, platform=project.platform, default="javascript", tagged=True
        )

        rp = RuleProcessor(test_event, False, False, False, False)
        rp.activate_downstream_actions(rule)

        for callback, futures in rp.grouped_futures.values():
            safe_execute(callback, test_event, futures, _with_transaction=False)

        return Response()
