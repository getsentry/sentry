from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Any, Literal, TypedDict

from sentry import features
from sentry.integrations.messaging.types import LEVEL_TO_COLOR
from sentry.integrations.types import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.models.team import Team
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notifications.rules import AlertRuleNotification
from sentry.notifications.utils.links import create_link_to_workflow
from sentry.notifications.utils.rules import get_key_from_rule_data, get_rule_or_workflow_id
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.users.services.user import RpcUser
from sentry.utils.http import absolute_uri


class _SlackText(TypedDict):
    type: Literal["plain_text"]
    text: str


class _SlackActorOption(TypedDict):
    text: _SlackText
    value: str


class _NonSlackActorOption(TypedDict):
    text: str
    value: str


def _actor_text_and_value(actor: Team | RpcUser) -> tuple[str, str]:
    if isinstance(actor, RpcUser):
        return (actor.get_display_name(), f"user:{actor.id}")
    elif isinstance(actor, Team):
        return (f"#{actor.slug}", f"team:{actor.id}")
    else:
        raise AssertionError("unreachable")


def format_actor_option_non_slack(actor: Team | RpcUser) -> _NonSlackActorOption:
    text, value = _actor_text_and_value(actor)
    return {"text": text, "value": value}


def format_actor_options_non_slack(actors: Iterable[Team | RpcUser]) -> list[_NonSlackActorOption]:
    return sorted(
        (format_actor_option_non_slack(actor) for actor in actors), key=lambda dct: dct["text"]
    )


def format_actor_option_slack(actor: Team | RpcUser) -> _SlackActorOption:
    text, value = _actor_text_and_value(actor)
    return {"text": {"type": "plain_text", "text": text}, "value": value}


def format_actor_options_slack(actors: Iterable[Team | RpcUser]) -> list[_SlackActorOption]:
    return sorted(
        (format_actor_option_slack(actor) for actor in actors), key=lambda dct: dct["text"]["text"]
    )


def build_attachment_title(obj: Group | Event | GroupEvent) -> str:
    ev_metadata = obj.get_event_metadata()
    ev_type = obj.get_event_type()
    title = obj.title

    if ev_type == "error" and "type" in ev_metadata:
        title = ev_metadata["type"]

    elif ev_type == "csp":
        title = f'{ev_metadata["directive"]} - {ev_metadata["uri"]}'
    else:
        if isinstance(obj, GroupEvent):
            if obj.occurrence is not None:
                title = obj.occurrence.issue_title
        else:
            if not isinstance(obj, Group):
                group = obj.group
            else:
                group = obj

            if group is not None:
                event = group.get_latest_event()
                if event is not None and event.occurrence is not None:
                    title = event.occurrence.issue_title

    return title


def fetch_environment_name(rule_env: int) -> str | None:
    try:
        env = Environment.objects.get(id=rule_env)
    except Environment.DoesNotExist:
        return None
    else:
        return env.name


def get_rule_environment_param_from_rule(
    rule_id: int, rule_environment_id: int | None, organization: Organization, type_id: int
) -> dict[str, str]:
    from sentry.notifications.notification_action.utils import should_fire_workflow_actions

    params = {}
    if should_fire_workflow_actions(organization, type_id):
        if (
            rule_environment_id is not None
            and (environment_name := fetch_environment_name(rule_environment_id)) is not None
        ):
            params["environment"] = environment_name
    else:
        try:
            rule = Rule.objects.get(id=rule_id)
        except Rule.DoesNotExist:
            rule_env = None
        else:
            rule_env = rule.environment_id

        if (
            rule_env is not None
            and (environment_name := fetch_environment_name(rule_env)) is not None
        ):
            params["environment"] = environment_name
    return params


def get_title_link(
    group: Group,
    event: Event | GroupEvent | None,
    link_to_event: bool,
    issue_details: bool,
    notification: BaseNotification | None,
    provider: ExternalProviders,
    rule_id: int | None = None,
    rule_environment_id: int | None = None,
    notification_uuid: str | None = None,
) -> str:
    other_params = {}
    # add in rule id if we have it
    if rule_id:
        other_params.update(
            get_rule_environment_param_from_rule(
                rule_id, rule_environment_id, group.organization, group.type
            )
        )
        # hard code for issue alerts
        other_params["alert_rule_id"] = str(rule_id)
        other_params["alert_type"] = "issue"

    if event and link_to_event:
        url = group.get_absolute_url(
            params={"referrer": EXTERNAL_PROVIDERS[provider], **other_params},
            event_id=event.event_id,
        )

    elif issue_details and notification:
        referrer = notification.get_referrer(provider)
        notification_uuid = notification.notification_uuid
        url = group.get_absolute_url(
            params={"referrer": referrer, "notification_uuid": notification_uuid, **other_params}
        )
    elif notification_uuid:
        url = group.get_absolute_url(
            params={
                "referrer": EXTERNAL_PROVIDERS[provider],
                "notification_uuid": notification_uuid,
                **other_params,
            }
        )
    else:
        url = group.get_absolute_url(
            params={"referrer": EXTERNAL_PROVIDERS[provider], **other_params}
        )

    return url


def get_title_link_workflow_engine_ui(
    group: Group,
    event: Event | GroupEvent | None,
    link_to_event: bool,
    issue_details: bool,
    notification: BaseNotification | None,
    provider: ExternalProviders,
    workflow_id: int | None = None,
    environment_id: int | None = None,
    notification_uuid: str | None = None,
) -> str:
    other_params = {}
    # add in rule id if we have it
    if workflow_id:
        if (
            environment_id is not None
            and (environment_name := fetch_environment_name(environment_id)) is not None
        ):
            other_params["environment"] = environment_name
        # hard code for issue alerts
        other_params["workflow_id"] = str(workflow_id)
        other_params["alert_type"] = "issue"

    if event and link_to_event:
        url = group.get_absolute_url(
            params={"referrer": EXTERNAL_PROVIDERS[provider], **other_params},
            event_id=event.event_id,
        )

    elif issue_details and notification:
        referrer = notification.get_referrer(provider)
        notification_uuid = notification.notification_uuid
        url = group.get_absolute_url(
            params={"referrer": referrer, "notification_uuid": notification_uuid, **other_params}
        )
    elif notification_uuid:
        url = group.get_absolute_url(
            params={
                "referrer": EXTERNAL_PROVIDERS[provider],
                "notification_uuid": notification_uuid,
                **other_params,
            }
        )
    else:
        url = group.get_absolute_url(
            params={"referrer": EXTERNAL_PROVIDERS[provider], **other_params}
        )

    return url


def build_attachment_text(group: Group, event: Event | GroupEvent | None = None) -> Any | None:
    # Group and Event both implement get_event_{type,metadata}
    obj = event if event is not None else group
    ev_metadata = obj.get_event_metadata()
    ev_type = obj.get_event_type()

    if not event:
        event = group.get_latest_event()

    if isinstance(event, GroupEvent) and event.occurrence is not None:
        important = event.occurrence.important_evidence_display
        if important:
            return important.value
    elif ev_type == "error":
        return ev_metadata.get("value") or ev_metadata.get("function")

    return None


def build_attachment_replay_link(
    group: Group, url_format: str, event: Event | GroupEvent | None = None
) -> str | None:
    has_replay = features.has("organizations:session-replay", group.organization)
    has_slack_links = features.has(
        "organizations:session-replay-slack-new-issue", group.organization
    )
    if has_replay and has_slack_links and group.has_replays():
        referrer = EXTERNAL_PROVIDERS[ExternalProviders.SLACK]
        replay_url = f"{group.get_absolute_url()}replays/?referrer={referrer}"

        return f"{url_format.format(text='View Replays', url=absolute_uri(replay_url))}"

    return None


def build_rule_url(rule: Any, group: Group, project: Project) -> str:
    from sentry.notifications.notification_action.utils import should_fire_workflow_actions

    org_slug = group.organization.slug
    project_slug = project.slug
    if should_fire_workflow_actions(group.organization, group.type):
        rule_id = get_key_from_rule_data(rule, "legacy_rule_id")
        rule_url = f"/organizations/{org_slug}/alerts/rules/{project_slug}/{rule_id}/details/"
    else:
        rule_url = f"/organizations/{org_slug}/alerts/rules/{project_slug}/{rule.id}/details/"

    return absolute_uri(rule_url)


def build_footer(
    group: Group,
    project: Project,
    url_format: str,
    rules: Sequence[Rule] | None = None,
) -> str:
    footer = f"{group.qualified_short_id}"
    if rules:
        key, value = get_rule_or_workflow_id(rules[0])
        if key == "workflow_id":
            rule_url = absolute_uri(create_link_to_workflow(group.organization.id, value))
        else:
            rule_url = build_rule_url(rules[0], group, project)

        # If this notification is triggered via the "Send Test Notification"
        # button then the label is not defined, but the url works.
        text = rules[0].label if rules[0].label else "Test Alert"
        footer += f" via {url_format.format(text=text, url=rule_url)}"

        if len(rules) > 1:
            footer += f" (+{len(rules) - 1} other)"

    return footer


def get_timestamp(group: Group, event: GroupEvent | None) -> float:
    ts = group.last_seen
    return (max(ts, event.datetime) if event else ts).timestamp()


def get_color(
    event_for_tags: GroupEvent | None, notification: BaseNotification | None, group: Group
) -> str:
    if notification:
        if not isinstance(notification, AlertRuleNotification):
            return "info"
    if event_for_tags:
        color: str | None = event_for_tags.get_tag("level")
        if (
            hasattr(event_for_tags, "occurrence")
            and event_for_tags.occurrence is not None
            and event_for_tags.occurrence.level is not None
        ):
            color = event_for_tags.occurrence.level
        if color and color in LEVEL_TO_COLOR.keys():
            return color

    return "error"
