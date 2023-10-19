import logging
from typing import Any, Optional, Sequence

from sentry.incidents.models import AlertRuleTriggerAction
from sentry.integrations.slack.utils import (
    SLACK_RATE_LIMITED_MESSAGE,
    RedisRuleStatus,
    get_channel_id_with_timeout,
    strip_channel_name,
)
from sentry.mediators.project_rules.creator import Creator
from sentry.mediators.project_rules.updater import Updater
from sentry.models.project import Project
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import ApiRateLimitedError, DuplicateDisplayNameError
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task

logger = logging.getLogger("sentry.integrations.slack.tasks")


@instrumented_task(
    name="sentry.integrations.slack.search_channel_id",
    queue="integrations",
    silo_mode=SiloMode.REGION,
)
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

    integrations = integration_service.get_integrations(
        organization_id=organization.id, providers=["slack"], integration_ids=[integration_id]
    )
    if not integrations:
        redis_rule_status.set_value("failed")
        return
    integration = integrations[0]
    logger.info(
        "rule.slack.search_channel_id",
        extra={
            "integration_id": integration.id,
            "organization_id": organization.id,
            "rule_id": rule_id,
        },
    )

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
        prefix = ""
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
            rule = Updater.run(rule=rule, pending_save=False, **kwargs)
        else:
            rule = Creator.run(pending_save=False, **kwargs)
            if user_id:
                RuleActivity.objects.create(
                    rule=rule, user_id=user_id, type=RuleActivityType.CREATED.value
                )

        redis_rule_status.set_value("success", rule.id)
        return
    # if we never find the channel name we failed :(
    redis_rule_status.set_value("failed")
