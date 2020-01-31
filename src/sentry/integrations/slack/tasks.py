from __future__ import absolute_import

import six

from django.conf import settings

from sentry.utils import json
from sentry.tasks.base import instrumented_task
from sentry.models import Integration, Project, Rule
from sentry.integrations.slack.utils import get_channel_id_with_timeout

from sentry.utils.redis import redis_clusters

MEMBER_PREFIX = "@"
CHANNEL_PREFIX = "#"

LIST_TYPES = [
    ("channels", "channels", CHANNEL_PREFIX),
    ("groups", "groups", CHANNEL_PREFIX),
    ("users", "members", MEMBER_PREFIX),
]


class RedisRuleStatus(object):
    def __init__(self, uuid):
        self.uuid = uuid

        cluster_id = getattr(settings, "SENTRY_RULE_TASK_REDIS_CLUSTER", "default")
        self.client = redis_clusters.get(cluster_id)
        self._set_value("pending")

    def _get_redis_key(self):
        return u"slack-channel-task:1:{}".format(self.uuid)

    def _set_value(self, status, rule_id=None):
        value = self._format_value(status, rule_id)
        self.client.set(self._get_redis_key(), u"{}".format(value), ex=60 * 60)

    def _format_value(self, status, rule_id):
        value = {"status": status}
        if rule_id:
            value["rule_id"] = six.text_type(rule_id)
        if status == "failed":
            # TODO(meredith): set some generic error? or pass in an error?
            value["error"] = "some error"

        return json.dumps(value)


@instrumented_task(name="sentry.integrations.slack.search_channel_id", queue="integrations")
def find_channel_id_for_rule(serializer, project_id, uuid, rule_id=None):
    redis_rule_status = RedisRuleStatus(uuid)

    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        redis_rule_status._set_value("failed")
        return

    organization = project.organization
    integration_id = None
    channel_name = None

    for action in serializer.validated_data["actions"]:
        if action.get("workspace") and action.get("channel"):
            integration_id = action["workspace"]
            # we need to strip the prefix when searching on the channel name
            channel_name = action["channel"].strip("#@")
            break

    try:
        integration = Integration.objects.get(
            provider="slack", organizations=organization, id=integration_id
        )
    except Integration.DoesNotExist:
        redis_rule_status._set_value("failed")
        return

    # 3 minutes should be enough to find the channel
    (prefix, item_id) = get_channel_id_with_timeout(integration, channel_name, 3 * 60)

    # if we couldn't find the item, we failed
    if not item_id:
        redis_rule_status._set_value("failed")
        return

    if rule_id:
        rule = Rule.objects.get(id=rule_id)
    else:
        rule = Rule()

    rule = serializer.save(rule)
    redis_rule_status._set_value("success", rule.id)
    return
