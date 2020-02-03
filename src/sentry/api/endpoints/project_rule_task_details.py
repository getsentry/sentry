from __future__ import absolute_import

from django.conf import settings
from django.http import Http404
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission
from sentry.api.serializers import serialize
from sentry.models import Rule, RuleStatus

from sentry.utils import json
from sentry.utils.redis import redis_clusters


def _get_value_from_redis(task_uuid):
    cluster_key = getattr(settings, "SENTRY_RULE_TASK_REDIS_CLUSTER", "default")
    client = redis_clusters.get(cluster_key)
    key = u"slack-channel-task:1:{}".format(task_uuid)
    value = client.get(key)
    return json.loads(value)


class ProjectRuleTaskDetailsEndpoint(ProjectEndpoint):
    permission_classes = [ProjectSettingPermission]

    def get(self, request, project, task_uuid):
        """
        Retrieve the status of the async task

        Return details of the rule if the task is successful

        """
        result = _get_value_from_redis(task_uuid)
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
