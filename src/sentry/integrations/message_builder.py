from __future__ import annotations

from abc import ABC
from typing import Any, Callable, Mapping, Sequence

from sentry import features
from sentry.eventstore.models import GroupEvent
from sentry.integrations.slack.message_builder import SLACK_URL_FORMAT
from sentry.models import Group, Project, Rule, Team
from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils.http import absolute_uri


class AbstractMessageBuilder(ABC):
    pass


def format_actor_options(actors: Sequence[Team | RpcUser]) -> Sequence[Mapping[str, str]]:
    sort_func: Callable[[Mapping[str, str]], Any] = lambda actor: actor["text"]
    return sorted((format_actor_option(actor) for actor in actors), key=sort_func)


def format_actor_option(actor: Team | RpcUser) -> Mapping[str, str]:
    if isinstance(actor, RpcUser):
        return {"text": actor.get_display_name(), "value": f"user:{actor.id}"}
    if isinstance(actor, Team):
        return {"text": f"#{actor.slug}", "value": f"team:{actor.id}"}

    raise NotImplementedError


def build_attachment_title(obj: Group | GroupEvent) -> str:
    ev_metadata = obj.get_event_metadata()
    ev_type = obj.get_event_type()
    title = obj.title

    if ev_type == "error" and "type" in ev_metadata:
        title = ev_metadata["type"]

    elif ev_type == "csp":
        title = f'{ev_metadata["directive"]} - {ev_metadata["uri"]}'

    else:
        group = getattr(obj, "group", obj)
        if isinstance(obj, GroupEvent) and obj.occurrence is not None:
            title = obj.occurrence.issue_title
        else:
            event = group.get_latest_event()
            if event is not None and event.occurrence is not None:
                title = event.occurrence.issue_title

    return title


def get_title_link(
    group: Group,
    event: GroupEvent | None,
    link_to_event: bool,
    issue_details: bool,
    notification: BaseNotification | None,
    provider: ExternalProviders = ExternalProviders.SLACK,
    rule_id: int | None = None,
) -> str:
    other_params = {}
    # add in rule id if we have it
    if rule_id:
        other_params["alert_rule_id"] = rule_id
        # hard code for issue alerts
        other_params["alert_type"] = "issue"

    if event and link_to_event:
        url = group.get_absolute_url(
            params={"referrer": EXTERNAL_PROVIDERS[provider], **other_params},
            event_id=event.event_id,
        )

    elif issue_details and notification:
        referrer = notification.get_referrer(provider)
        url = group.get_absolute_url(params={"referrer": referrer, **other_params})
    else:
        url = group.get_absolute_url(
            params={"referrer": EXTERNAL_PROVIDERS[provider], **other_params}
        )

    return url


def build_attachment_text(group: Group, event: GroupEvent | None = None) -> Any | None:
    # Group and Event both implement get_event_{type,metadata}
    obj = event if event is not None else group
    ev_metadata = obj.get_event_metadata()
    ev_type = obj.get_event_type()

    if not event:
        event = group.get_latest_event()

    if event and getattr(event, "occurrence", None) is not None:
        important = event.occurrence.important_evidence_display
        if important:
            return important.value
    elif ev_type == "error":
        return ev_metadata.get("value") or ev_metadata.get("function")

    return None


def build_attachment_replay_link(
    group: Group, event: GroupEvent | None = None, url_format: str = SLACK_URL_FORMAT
) -> str | None:
    has_replay = features.has("organizations:session-replay", group.organization)
    has_slack_links = features.has(
        "organizations:session-replay-slack-new-issue", group.organization
    )
    if has_replay and has_slack_links and group.has_replays():
        referrer = EXTERNAL_PROVIDERS[ExternalProviders.SLACK]
        replay_url = f"{group.get_absolute_url()}replays/?referrer={referrer}"

        return f"\n\n{url_format.format(text='View Replays', url=absolute_uri(replay_url))}"

    return None


def build_rule_url(rule: Any, group: Group, project: Project) -> str:
    org_slug = group.organization.slug
    project_slug = project.slug
    rule_url = f"/organizations/{org_slug}/alerts/rules/{project_slug}/{rule.id}/details/"

    return absolute_uri(rule_url)


def build_footer(
    group: Group,
    project: Project,
    rules: Sequence[Rule] | None = None,
    url_format: str = SLACK_URL_FORMAT,
) -> str:
    footer = f"{group.qualified_short_id}"
    if rules:
        rule_url = build_rule_url(rules[0], group, project)
        footer += f" via {url_format.format(text=rules[0].label, url=rule_url)}"

        if len(rules) > 1:
            footer += f" (+{len(rules) - 1} other)"

    return footer
