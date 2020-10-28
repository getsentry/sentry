from __future__ import absolute_import

from django.http import Http404
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission
from sentry.api.serializers import serialize
from sentry.integrations.slack import tasks
from sentry.models import Rule, RuleStatus


class ProjectRuleTaskDetailsEndpoint(ProjectEndpoint):
    permission_classes = [ProjectSettingPermission]

    def get(self, request, project, task_uuid):
        """
        Retrieve the status of the async task

        Return details of the rule if the task is successful

        """
        client = tasks.RedisRuleStatus(task_uuid)
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
                    status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE],
                )
                context["rule"] = serialize(rule, request.user)
            except Rule.DoesNotExist:
                raise Http404

        if status == "failed":
            context["error"] = error

        return Response(context, status=200)
