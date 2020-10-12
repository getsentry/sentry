from __future__ import absolute_import

import six
from uuid import uuid4

from django.conf import settings
from rest_framework import serializers

from sentry.auth.access import SystemAccess
from sentry.utils import json
from sentry.tasks.base import instrumented_task
from sentry.mediators import project_rules
from sentry.models import Integration, Project, Rule, Organization
from sentry.incidents.endpoints.serializers import AlertRuleSerializer
from sentry.integrations.slack.utils import get_channel_id_with_timeout, strip_channel_name
from sentry.utils.redis import redis_clusters
from sentry.shared_integrations.exceptions import DuplicateDisplayNameError


class RedisRuleStatus(object):
    def __init__(self, uuid=None):
        self._uuid = uuid or self._generate_uuid()

        cluster_id = getattr(settings, "SENTRY_RULE_TASK_REDIS_CLUSTER", "default")
        self.client = redis_clusters.get(cluster_id)
        self._set_inital_value()

    @property
    def uuid(self):
        return self._uuid

    def set_value(self, status, rule_id=None):
        value = self._format_value(status, rule_id)
        self.client.set(self._get_redis_key(), u"{}".format(value), ex=60 * 60)

    def get_value(self):
        key = self._get_redis_key()
        value = self.client.get(key)
        return json.loads(value)

    def _generate_uuid(self):
        return uuid4().hex

    def _set_inital_value(self):
        value = json.dumps({"status": "pending"})
        self.client.set(self._get_redis_key(), u"{}".format(value), ex=60 * 60, nx=True)

    def _get_redis_key(self):
        return u"slack-channel-task:1:{}".format(self.uuid)

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
def find_channel_id_for_rule(project, actions, uuid, rule_id=None, **kwargs):
    redis_rule_status = RedisRuleStatus(uuid)

    try:
        project = Project.objects.get(id=project.id)
    except Project.DoesNotExist:
        redis_rule_status.set_value("failed")
        return

    organization = project.organization
    integration_id = None
    channel_name = None

    # TODO: make work for multiple Slack actions
    for action in actions:
        if action.get("workspace") and action.get("channel"):
            integration_id = action["workspace"]
            # we need to strip the prefix when searching on the channel name
            channel_name = strip_channel_name(action["channel"])
            break

    try:
        integration = Integration.objects.get(
            provider="slack", organizations=organization, id=integration_id
        )
    except Integration.DoesNotExist:
        redis_rule_status.set_value("failed")
        return

    # we dont' know exactly how long it will take to paginate through all of the slack
    # endpoints but need some time limit imposed. 3 minutes should be more than enough time,
    # we can always update later
    try:
        (prefix, item_id, _timed_out) = get_channel_id_with_timeout(
            integration, channel_name, 3 * 60
        )
    except DuplicateDisplayNameError:
        # if we find a duplicate display name and nothing else, we
        # want to set the status to failed. This just lets us skip
        # over the next block and hit the failed status at the end.
        item_id = None

    if item_id:
        for action in actions:
            # need to make sure we are adding back the right prefix and also the channel_id
            if action.get("channel") and strip_channel_name(action.get("channel")) == channel_name:
                action["channel"] = prefix + channel_name
                action["channel_id"] = item_id
                break

        kwargs["actions"] = actions
        kwargs["project"] = project

        if rule_id:
            rule = Rule.objects.get(id=rule_id)
            rule = project_rules.Updater.run(rule=rule, pending_save=False, **kwargs)
        else:
            rule = project_rules.Creator.run(pending_save=False, **kwargs)

        redis_rule_status.set_value("success", rule.id)
        return
    # if we never find the channel name we failed :(
    redis_rule_status.set_value("failed")


@instrumented_task(
    name="sentry.integrations.slack.search_channel_id_metric_alerts", queue="integrations"
)
def find_channel_id_for_alert_rule(organization_id, uuid, rule_id=None, **kwargs):
    redis_rule_status = RedisRuleStatus(uuid)

    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        redis_rule_status.set_value("failed")
        return

    print("do task lookup")
    kwargs["use_async_lookup"] = True
    serializer = AlertRuleSerializer(
        context={"organization": organization, "access": SystemAccess()}, data=kwargs,
    )
    if serializer.is_valid():
        try:
            alert_rule = serializer.save()
            redis_rule_status.set_value("success", alert_rule.id)
            return
        except serializers.ValidationError:
            # channel doesn't exist error
            redis_rule_status.set_value("failed")
            return

    # some other error
    redis_rule_status.set_value("failed")
    return
