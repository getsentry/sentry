import logging
from typing import Any, Optional, Sequence
from uuid import uuid4

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from sentry.auth.access import SystemAccess
from sentry.incidents.endpoints.serializers import AlertRuleSerializer
from sentry.incidents.logic import (
    ChannelLookupTimeoutError,
    InvalidTriggerActionError,
    get_slack_channel_ids,
)
from sentry.incidents.models import AlertRule, AlertRuleTriggerAction
from sentry.integrations.utils import get_identities_by_user
from sentry.mediators import project_rules
from sentry.models import (
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    Organization,
    Project,
    Rule,
    RuleActivity,
    RuleActivityType,
    User,
    UserEmail,
)
from sentry.shared_integrations.exceptions import ApiRateLimitedError, DuplicateDisplayNameError
from sentry.tasks.base import instrumented_task
from sentry.utils import json
from sentry.utils.json import JSONData
from sentry.utils.redis import redis_clusters

from .utils import (
    SLACK_RATE_LIMITED_MESSAGE,
    get_channel_id_with_timeout,
    get_slack_data_by_user,
    strip_channel_name,
)

logger = logging.getLogger("sentry.integrations.slack.tasks")


SLACK_FAILED_MESSAGE = (
    "The slack resource does not exist or has not been granted access in that workspace."
)


class RedisRuleStatus:
    def __init__(self, uuid: Optional[str] = None) -> None:
        self._uuid = uuid or self._generate_uuid()

        cluster_id = getattr(settings, "SENTRY_RULE_TASK_REDIS_CLUSTER", "default")
        self.client = redis_clusters.get(cluster_id)
        self._set_initial_value()

    @property
    def uuid(self) -> str:
        return self._uuid

    def set_value(
        self, status: str, rule_id: Optional[int] = None, error_message: Optional[str] = None
    ) -> None:
        value = self._format_value(status, rule_id, error_message)
        self.client.set(self._get_redis_key(), f"{value}", ex=60 * 60)

    def get_value(self) -> JSONData:
        key = self._get_redis_key()
        value = self.client.get(key)
        return json.loads(value)

    def _generate_uuid(self) -> str:
        return uuid4().hex

    def _set_initial_value(self) -> None:
        value = json.dumps({"status": "pending"})
        self.client.set(self._get_redis_key(), f"{value}", ex=60 * 60, nx=True)

    def _get_redis_key(self) -> str:
        return f"slack-channel-task:1:{self.uuid}"

    def _format_value(
        self, status: str, rule_id: Optional[int], error_message: Optional[str]
    ) -> str:
        value = {"status": status}
        if rule_id:
            value["rule_id"] = str(rule_id)
        if error_message:
            value["error"] = error_message
        elif status == "failed":
            value["error"] = SLACK_FAILED_MESSAGE

        # Explicitly typing to satisfy mypy.
        _value: str = json.dumps(value)
        return _value


@instrumented_task(name="sentry.integrations.slack.search_channel_id", queue="integrations")  # type: ignore
def find_channel_id_for_rule(
    project: Project,
    actions: Sequence[AlertRuleTriggerAction],
    uuid: str,
    rule_id: Optional[int] = None,
    user_id: Optional[int] = None,
    **kwargs: Any,
) -> None:
    redis_rule_status = RedisRuleStatus(uuid)

    try:
        project = Project.objects.get(id=project.id)
    except Project.DoesNotExist:
        redis_rule_status.set_value("failed")
        return

    user = None
    if user_id:
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            pass

    organization = project.organization
    integration_id: Optional[int] = None
    channel_name: Optional[str] = None

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

    # We do not know exactly how long it will take to paginate through all of the Slack
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
    except ApiRateLimitedError:
        redis_rule_status.set_value("failed", None, SLACK_RATE_LIMITED_MESSAGE)
        return

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
            if user:
                RuleActivity.objects.create(
                    rule=rule, user=user, type=RuleActivityType.CREATED.value
                )

        redis_rule_status.set_value("success", rule.id)
        return
    # if we never find the channel name we failed :(
    redis_rule_status.set_value("failed")


@instrumented_task(  # type: ignore
    name="sentry.integrations.slack.search_channel_id_metric_alerts", queue="integrations"
)
def find_channel_id_for_alert_rule(
    organization_id: int,
    uuid: str,
    data: Any,
    alert_rule_id: Optional[int] = None,
    user_id: Optional[int] = None,
) -> None:
    redis_rule_status = RedisRuleStatus(uuid)
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        redis_rule_status.set_value("failed")
        return

    user = None
    if user_id:
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            pass

    alert_rule = None
    if alert_rule_id:
        try:
            alert_rule = AlertRule.objects.get(organization_id=organization_id, id=alert_rule_id)
        except AlertRule.DoesNotExist:
            redis_rule_status.set_value("failed")
            return

    try:
        mapped_ids = get_slack_channel_ids(organization, user, data)
    except (serializers.ValidationError, ChannelLookupTimeoutError, InvalidTriggerActionError) as e:
        # channel doesn't exist error or validation error
        logger.info(
            "get_slack_channel_ids.failed",
            extra={
                "exception": e,
            },
        )
        redis_rule_status.set_value("failed")
        return
    except ApiRateLimitedError as e:
        logger.info(
            "get_slack_channel_ids.rate_limited",
            extra={
                "exception": e,
            },
        )
        redis_rule_status.set_value("failed", None, SLACK_RATE_LIMITED_MESSAGE)
        return

    for trigger in data["triggers"]:
        for action in trigger["actions"]:
            if action["type"] == "slack":
                if action["targetIdentifier"] in mapped_ids:
                    action["input_channel_id"] = mapped_ids[action["targetIdentifier"]]
                else:
                    # We can early exit because we couldn't map this action's slack channel name to a slack id
                    # This is a fail safe, but I think we shouldn't really hit this.
                    redis_rule_status.set_value("failed")
                    return

    # we use SystemAccess here because we can't pass the access instance from the request into the task
    # this means at this point we won't raise any validation errors associated with permissions
    # however, we should only be calling this task after we tried saving the alert rule first
    # which will catch those kinds of validation errors
    serializer = AlertRuleSerializer(
        context={
            "organization": organization,
            "access": SystemAccess(),
            "user": user,
            "use_async_lookup": True,
            "validate_channel_id": False,
        },
        data=data,
        instance=alert_rule,
    )
    if serializer.is_valid():
        try:
            alert_rule = serializer.save()
            redis_rule_status.set_value("success", alert_rule.id)
            return
        # we can still get a validation error for the channel not existing
        except (serializers.ValidationError, ChannelLookupTimeoutError):
            # channel doesn't exist error or validation error
            redis_rule_status.set_value("failed")
            return
    # some other error
    redis_rule_status.set_value("failed")
    return


@instrumented_task(name="sentry.integrations.slack.link_users_identities", queue="integrations")  # type: ignore
def link_slack_user_identities(integration: Integration, organization: Organization) -> None:
    emails_by_user = UserEmail.objects.get_emails_by_user(organization)
    slack_data_by_user = get_slack_data_by_user(integration, organization, emails_by_user)

    idp = IdentityProvider.objects.get(
        type=integration.provider,
        external_id=integration.external_id,
    )
    date_verified = timezone.now()
    identities_by_user = get_identities_by_user(idp, slack_data_by_user.keys())

    for user, data in slack_data_by_user.items():
        # Identity already exists, the emails match, AND the external ID has changed
        if user in identities_by_user.keys():
            if data["slack_id"] != identities_by_user[user].external_id:
                # replace the Identity's external_id with the new one we just got from Slack
                identities_by_user[user].update(external_id=data["slack_id"])
            continue
        # the user doesn't already have an Identity and one of their Sentry emails matches their Slack email
        matched_identity, created = Identity.objects.get_or_create(
            idp=idp,
            external_id=data["slack_id"],
            defaults={"user": user, "status": IdentityStatus.VALID, "date_verified": date_verified},
        )
        # the Identity matching that idp/external_id combo is linked to a different user
        if not created:
            logger.info(
                "post_install.identity_linked_different_user",
                extra={
                    "idp_id": idp.id,
                    "external_id": data["slack_id"],
                    "object_id": matched_identity.id,
                    "user_id": user.id,
                    "type": idp.type,
                },
            )
