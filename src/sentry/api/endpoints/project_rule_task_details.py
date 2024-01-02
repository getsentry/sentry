from django.http import Http404
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.integrations.slack.utils import RedisRuleStatus
from sentry.models.rule import Rule


@region_silo_endpoint
class ProjectRuleTaskDetailsEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (ProjectSettingPermission,)

    def get(self, request: Request, project, task_uuid) -> Response:
        """
        Retrieve the status of the async task

        Return details of the rule if the task is successful

        """
        client = RedisRuleStatus(task_uuid)
        result = client.get_value()

        status = result["status"]
        rule_id = result.get("rule_id")
        error = result.get("error")

        # if the status is "pending" we don't have a rule yet or error
        context = {"status": status, "rule": None, "error": None}

        if rule_id and status == "success":
            try:
                rule = Rule.objects.get(
                    project=project,
                    id=int(rule_id),
                    status=ObjectStatus.ACTIVE,
                )
                context["rule"] = serialize(rule, request.user)
            except Rule.DoesNotExist:
                raise Http404

        if status == "failed":
            context["error"] = error

        return Response(context, status=200)
