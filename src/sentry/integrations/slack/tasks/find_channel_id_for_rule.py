import logging
from collections.abc import Sequence
from typing import Any

from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.utils.channel import (
    SlackChannelIdData,
    get_channel_id_with_timeout,
    strip_channel_name,
)
from sentry.integrations.slack.utils.constants import SLACK_RATE_LIMITED_MESSAGE
from sentry.integrations.slack.utils.rule_status import RedisRuleStatus
from sentry.models.project import Project
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
from sentry.projects.project_rules.creator import ProjectRuleCreator
from sentry.projects.project_rules.updater import ProjectRuleUpdater
from sentry.shared_integrations.exceptions import ApiRateLimitedError, DuplicateDisplayNameError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task

logger = logging.getLogger("sentry.integrations.slack.tasks")


@instrumented_task(
    name="sentry.integrations.slack.tasks.search_channel_id_for_rule",
    queue="integrations",
    silo_mode=SiloMode.REGION,
)
def find_channel_id_for_rule(
    project: Project,
    actions: Sequence[dict[str, Any]],
    uuid: str,
    rule_id: int | None = None,
    user_id: int | None = None,
    **kwargs: Any,
) -> None:
    redis_rule_status = RedisRuleStatus(uuid)

    try:
        project = Project.objects.get(id=project.id)
    except Project.DoesNotExist:
        redis_rule_status.set_value("failed")
        return

    organization = project.organization
    integration_id: int | None = None
    channel_name: str | None = None

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
    channel_data: SlackChannelIdData | None = None
    try:
        channel_data = get_channel_id_with_timeout(
            integration,
            channel_name,
            timeout=3 * 60,
        )
    except DuplicateDisplayNameError:
        # if we find a duplicate display name and nothing else, we
        # want to set the status to failed. This just lets us skip
        # over the next block and hit the failed status at the end.
        redis_rule_status.set_value("failed")
    except ApiRateLimitedError:
        redis_rule_status.set_value("failed", None, SLACK_RATE_LIMITED_MESSAGE)
        return

    if channel_data and channel_data.channel_id:
        for action in actions:
            # need to make sure we are adding back the right prefix and also the channel_id
            action_channel = action.get("channel")
            if (
                action_channel
                and channel_name
                and strip_channel_name(action_channel) == channel_name
            ):
                action["channel"] = channel_data.prefix + channel_name
                action["channel_id"] = channel_data.channel_id
                break

        kwargs["actions"] = actions
        kwargs["project"] = project

        if rule_id:
            rule = Rule.objects.get(id=rule_id)
            rule = ProjectRuleUpdater(
                rule=rule,
                project=project,
                name=kwargs.get("name"),
                owner=kwargs.get("owner"),
                environment=kwargs.get("environment"),
                action_match=kwargs.get("action_match"),
                filter_match=kwargs.get("filter_match"),
                actions=actions,
                conditions=kwargs.get("conditions"),
                frequency=kwargs.get("frequency"),
                request=kwargs.get("request"),
            ).run()
        else:
            rule = ProjectRuleCreator(
                name=kwargs["name"],
                project=project,
                action_match=kwargs["action_match"],
                actions=actions,
                conditions=kwargs["conditions"],
                frequency=kwargs["frequency"],
                environment=kwargs.get("environment"),
                owner=kwargs.get("owner"),
                filter_match=kwargs.get("filter_match"),
                request=kwargs.get("request"),
            ).run()
            if user_id:
                RuleActivity.objects.create(
                    rule=rule, user_id=user_id, type=RuleActivityType.CREATED.value
                )

        redis_rule_status.set_value("success", rule.id)
        return
    # if we never find the channel name we failed :(
    redis_rule_status.set_value("failed")
