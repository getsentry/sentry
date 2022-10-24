from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from django.core.cache import cache
from sentry_relay import parse_release

from sentry import tagstore
from sentry.eventstore.models import GroupEvent
from sentry.integrations.message_builder import (
    build_attachment_text,
    build_attachment_title,
    build_footer,
    format_actor_options,
    get_title_link,
)
from sentry.integrations.slack.message_builder import LEVEL_TO_COLOR, SLACK_URL_FORMAT, SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.integrations.slack.utils.escape import escape_slack_text
from sentry.models import (
    ActorTuple,
    Group,
    GroupStatus,
    Identity,
    Project,
    Release,
    ReleaseProject,
    Rule,
    Team,
    User,
)
from sentry.notifications.notifications.active_release import CommitData
from sentry.notifications.notifications.base import BaseNotification, ProjectNotification
from sentry.notifications.notifications.rules import AlertRuleNotification
from sentry.notifications.utils.actions import MessageAction
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.utils.dates import to_timestamp

STATUSES = {"resolved": "resolved", "ignored": "ignored", "unresolved": "re-opened"}


def build_assigned_text(identity: Identity, assignee: str) -> str | None:
    actor = ActorTuple.from_actor_identifier(assignee)

    try:
        assigned_actor = actor.resolve()
    except actor.type.DoesNotExist:
        return None

    if actor.type == Team:
        assignee_text = f"#{assigned_actor.slug}"
    elif actor.type == User:
        try:
            assignee_ident = Identity.objects.get(
                user=assigned_actor, idp__type="slack", idp__external_id=identity.idp.external_id
            )
            assignee_text = f"<@{assignee_ident.external_id}>"
        except Identity.DoesNotExist:
            assignee_text = assigned_actor.get_display_name()
    else:
        raise NotImplementedError

    return f"*Issue assigned to {assignee_text} by <@{identity.external_id}>*"


def build_action_text(identity: Identity, action: MessageAction) -> str | None:
    if action.name == "assign":
        selected_options = action.selected_options or []
        if not len(selected_options):
            return None
        assignee = selected_options[0]["value"]
        return build_assigned_text(identity, assignee)

    # Resolve actions have additional 'parameters' after ':'
    status = STATUSES.get((action.value or "").split(":", 1)[0])

    # Action has no valid action text, ignore
    if not status:
        return None

    return f"*Issue {status} by <@{identity.external_id}>*"


def build_tag_fields(
    event_for_tags: Any, tags: set[str] | None = None
) -> Sequence[Mapping[str, str | bool]]:
    fields = []
    if tags:
        event_tags = event_for_tags.tags if event_for_tags else []
        for key, value in event_tags:
            std_key = tagstore.get_standardized_key(key)
            if std_key not in tags:
                continue

            labeled_value = tagstore.get_tag_value_label(key, value)
            fields.append(
                {
                    "title": std_key.encode("utf-8"),
                    "value": labeled_value.encode("utf-8"),
                    "short": True,
                }
            )
    return fields


def get_option_groups(group: Group) -> Sequence[Mapping[str, Any]]:
    members = User.objects.get_from_group(group).distinct()
    teams = group.project.teams.all()

    option_groups = []
    if teams:
        option_groups.append({"text": "Teams", "options": format_actor_options(teams)})

    if members:
        option_groups.append({"text": "People", "options": format_actor_options(members)})

    return option_groups


def has_releases(project: Project) -> bool:
    cache_key = f"has_releases:2:{project.id}"
    has_releases_option: bool | None = cache.get(cache_key)
    if has_releases_option is None:
        has_releases_option = ReleaseProject.objects.filter(project_id=project.id).exists()
        if has_releases_option:
            cache.set(cache_key, True, 3600)
        else:
            cache.set(cache_key, False, 60)
    return has_releases_option


def get_action_text(
    text: str,
    actions: Sequence[Any],
    identity: Identity | None = None,
) -> str:
    return (
        text
        + "\n"
        + "\n".join(
            [
                action_text
                for action_text in [build_action_text(identity, action) for action in actions]
                if action_text
            ]
        )
    )


def build_actions(
    group: Group,
    project: Project,
    text: str,
    color: str,
    actions: Sequence[MessageAction] | None = None,
    identity: Identity | None = None,
) -> tuple[Sequence[MessageAction], str, str]:
    """Having actions means a button will be shown on the Slack message e.g. ignore, resolve, assign."""
    if actions:
        text += get_action_text(text, actions, identity)
        return [], text, "_actioned_issue"

    ignore_button = MessageAction(
        name="status",
        label="Ignore",
        value="ignored",
    )

    resolve_button = MessageAction(
        name="resolve_dialog",
        label="Resolve...",
        value="resolve_dialog",
    )

    status = group.get_status()

    if not has_releases(project):
        resolve_button = MessageAction(
            name="status",
            label="Resolve",
            value="resolved",
        )

    if status == GroupStatus.RESOLVED:
        resolve_button = MessageAction(
            name="status",
            label="Unresolve",
            value="unresolved",
        )

    if status == GroupStatus.IGNORED:
        ignore_button = MessageAction(
            name="status",
            label="Stop Ignoring",
            value="unresolved",
        )

    assignee = group.get_assignee()
    assign_button = MessageAction(
        name="assign",
        label="Select Assignee...",
        type="select",
        selected_options=format_actor_options([assignee]) if assignee else [],
        option_groups=get_option_groups(group),
    )

    return [resolve_button, ignore_button, assign_button], text, color


def get_timestamp(group: Group, event: GroupEvent | None) -> float:
    ts = group.last_seen
    return to_timestamp(max(ts, event.datetime) if event else ts)


def get_color(event_for_tags: GroupEvent | None, notification: BaseNotification | None) -> str:
    if notification:
        if not isinstance(notification, AlertRuleNotification):
            return "info"
    if event_for_tags:
        color: str | None = event_for_tags.get_tag("level")
        if color and color in LEVEL_TO_COLOR.keys():
            return color
    return "error"


class SlackIssuesMessageBuilder(SlackMessageBuilder):
    """We're keeping around this awkward interface so that we can share logic with unfurling."""

    def __init__(
        self,
        group: Group,
        event: GroupEvent | None = None,
        tags: set[str] | None = None,
        identity: Identity | None = None,
        actions: Sequence[MessageAction] | None = None,
        rules: list[Rule] | None = None,
        link_to_event: bool = False,
        issue_details: bool = False,
        notification: ProjectNotification | None = None,
        recipient: Team | User | None = None,
    ) -> None:
        super().__init__()
        self.group = group
        self.event = event
        self.tags = tags
        self.identity = identity
        self.actions = actions
        self.rules = rules
        self.link_to_event = link_to_event
        self.issue_details = issue_details
        self.notification = notification
        self.recipient = recipient

    def build(self) -> SlackBody:
        # XXX(dcramer): options are limited to 100 choices, even when nested
        text = build_attachment_text(self.group, self.event) or ""
        project = Project.objects.get_from_cache(id=self.group.project_id)

        # If an event is unspecified, use the tags of the latest event (if one exists).
        event_for_tags = self.event or self.group.get_latest_event()
        color = get_color(event_for_tags, self.notification)
        fields = build_tag_fields(event_for_tags, self.tags)
        footer = (
            self.notification.build_notification_footer(self.recipient, ExternalProviders.SLACK)
            if self.notification and self.recipient
            else build_footer(self.group, project, self.rules, SLACK_URL_FORMAT)
        )
        obj = self.event if self.event is not None else self.group
        if not self.issue_details or (self.recipient and isinstance(self.recipient, Team)):
            payload_actions, text, color = build_actions(
                self.group, project, text, color, self.actions, self.identity
            )
        else:
            payload_actions = []
        return self._build(
            actions=payload_actions,
            callback_id=json.dumps({"issue": self.group.id}),
            color=color,
            fallback=self.build_fallback_text(obj, project.slug),
            fields=fields,
            footer=footer,
            text=text,
            title=build_attachment_title(obj),
            title_link=get_title_link(
                self.group,
                self.event,
                self.link_to_event,
                self.issue_details,
                self.notification,
                ExternalProviders.SLACK,
            ),
            ts=get_timestamp(self.group, self.event) if not self.issue_details else None,
        )


class SlackReleaseIssuesMessageBuilder(SlackMessageBuilder):
    """Same as SlackIssuesMessageBuilder but for new issues in a release"""

    def __init__(
        self,
        group: Group,
        event: GroupEvent | None = None,
        tags: set[str] | None = None,
        identity: Identity | None = None,
        actions: Sequence[MessageAction] | None = None,
        rules: list[Rule] | None = None,
        link_to_event: bool = False,
        issue_details: bool = False,
        notification: ProjectNotification | None = None,
        recipient: Team | User | None = None,
        last_release: Release | None = None,
        last_release_link: str | None = None,
        release_commits: Sequence[CommitData] | None = None,
    ) -> None:
        super().__init__()
        self.group = group
        self.event = event
        self.tags = tags
        self.identity = identity
        self.actions = actions
        self.rules = rules
        self.link_to_event = link_to_event
        self.issue_details = issue_details
        self.notification = notification
        self.recipient = recipient
        self.last_release = last_release
        self.last_release_link = last_release_link
        self.release_commits = release_commits

    @staticmethod
    def commit_data_text(commit_data: Optional[Sequence[CommitData]]) -> str:
        if not commit_data:
            return ""

        return "\n".join(
            [
                f'[{getattr(x.get("author"), "email") if x.get("author") else "no email"}] - {x.get("subject", "no subject")} ({x.get("key", "no key")})'
                for x in (commit_data or ())
            ]
        )

    def build(self) -> SlackBody:
        text = build_attachment_text(self.group, self.event) or ""
        # Shorten attchment text to end of first line or 80 characters
        newline_index = text.index("\n") if "\n" in text else 0
        text_split = min(newline_index, 80)
        text = text[:text_split]

        project = Project.objects.get_from_cache(id=self.group.project_id)

        # If an event is unspecified, use the tags of the latest event (if one exists).
        event_for_tags = self.event or self.group.get_latest_event()
        color = get_color(event_for_tags, self.notification)
        fields = build_tag_fields(event_for_tags, self.tags)
        footer = (
            self.notification.build_notification_footer(self.recipient, ExternalProviders.SLACK)
            if self.notification and self.recipient
            else build_footer(self.group, project, self.rules, SLACK_URL_FORMAT)
        )
        obj = self.event if self.event is not None else self.group
        if not self.issue_details or (self.recipient and isinstance(self.recipient, Team)):
            payload_actions, text, color = build_actions(
                self.group, project, text, color, self.actions, self.identity
            )
        else:
            payload_actions = []

        issue_title = build_attachment_title(obj)
        event_id = self.event.event_id if self.event else None
        # TODO(workflow): Remove referrer experiement with flag "organizations:active-release-monitor-alpha"
        title_url = self.group.get_absolute_url(
            params={"referrer": "alert_slack_release"}, event_id=event_id
        )
        release = (
            parse_release(self.last_release.version)["description"]
            if self.last_release
            else "unknown"
        )

        commit_text = self.commit_data_text(self.release_commits)
        if commit_text:
            commit_text = "\n" + commit_text

        return self._build(
            actions=payload_actions,
            callback_id=json.dumps({"issue": self.group.id}),
            color=color,
            fallback=f"[{project.slug}] {obj.title}",
            fields=fields,
            footer=footer,
            text=f"<{title_url}|*{escape_slack_text(issue_title)}*> {commit_text}\n{text}",
            title=f"Release <{self.last_release_link}|{release}> has a new issue",
            ts=get_timestamp(self.group, self.event) if not self.issue_details else None,
        )


def build_group_attachment(
    group: Group,
    event: GroupEvent | None = None,
    tags: set[str] | None = None,
    identity: Identity | None = None,
    actions: Sequence[MessageAction] | None = None,
    rules: list[Rule] | None = None,
    link_to_event: bool = False,
    issue_details: bool = False,
) -> SlackBody:
    """@deprecated"""
    return SlackIssuesMessageBuilder(
        group, event, tags, identity, actions, rules, link_to_event, issue_details
    ).build()
