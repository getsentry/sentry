from __future__ import absolute_import

import six

from django.conf import settings

from sentry import http
from sentry.utils import json
from sentry.tasks.base import instrumented_task
from sentry.models import Integration, Project, Rule

from sentry.utils.redis import redis_clusters
from sentry.mediators import project_rules

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
            value[
                "error"
            ] = "The slack resource does not exist or has not been granted access in that workspace."

        return json.dumps(value)


@instrumented_task(name="sentry.integrations.slack.search_channel_id", queue="integrations")
def find_channel_id_for_rule(
    name, environment, project, action_match, conditions, actions, frequency, uuid, rule_id=None
):
    redis_rule_status = RedisRuleStatus(uuid)

    try:
        project = Project.objects.get(id=project.id)
    except Project.DoesNotExist:
        redis_rule_status._set_value("failed")
        return

    organization = project.organization
    integration_id = None
    channel_name = None

    for action in actions:
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

    token_payload = {"token": integration.metadata["access_token"]}
    payload = dict(token_payload, **{"exclude_archived": False, "exclude_members": True})

    session = http.build_session()
    for list_type, result_name, prefix in LIST_TYPES:
        cursor = ""
        while cursor is not None:
            # XXX(meredith): change limit to 1000 instead of 1
            items = session.get(
                "https://slack.com/api/%s.list" % list_type,
                params=dict(payload, **{"cursor": cursor, "limit": 1}),
            )
            items = items.json()
            if not items.get("ok"):
                redis_rule_status._set_value("failed")
                return

            cursor = items.get("response_metadata", {}).get("next_cursor", None)
            if cursor == "":
                cursor = None

            item_id = {c["name"]: c["id"] for c in items[result_name]}.get(channel_name)
            if item_id:
                kwargs = {
                    "name": name,
                    "environment": environment,
                    "project": project,
                    "action_match": action_match,
                    "conditions": conditions,
                    "actions": actions,
                    "frequency": frequency,
                }

                if rule_id:
                    rule = Rule.objects.get(id=rule_id)
                    rule = project_rules.Updater.run(rule=rule, pending_save=False, **kwargs)
                else:
                    rule = project_rules.Creator.run(pending_save=False, **kwargs)

                redis_rule_status._set_value("success", rule.id)
                return
    # if we never find the channel name we failed :(
    redis_rule_status._set_value("failed")
