from __future__ import annotations

from typing import Any, Mapping, Sequence

from django.core.cache import cache

from sentry import features, tagstore
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
from sentry.issues.grouptype import GroupCategory
from sentry.models import ActorTuple, Group, GroupStatus, Project, ReleaseProject, Rule, Team, User
from sentry.notifications.notifications.base import BaseNotification, ProjectNotification
from sentry.notifications.notifications.rules import AlertRuleNotification
from sentry.notifications.utils.actions import MessageAction
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.identity import RpcIdentity, identity_service
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.utils.dates import to_timestamp

STATUSES = {"resolved": "resolved", "ignored": "ignored", "unresolved": "re-opened"}


def build_assigned_text(identity: RpcIdentity, assignee: str) -> str | None:
    actor = ActorTuple.from_actor_identifier(assignee)

    try:
        assigned_actor = actor.resolve()
    except actor.type.DoesNotExist:
        return None

    if actor.type == Team:
        assignee_text = f"#{assigned_actor.slug}"
    elif actor.type == User:
        assignee_identity = identity_service.get_identity(
            provider_id=identity.idp_id,
            user_id=assigned_actor.id,
        )
        assignee_text = (
            assigned_actor.get_display_name()
            if assignee_identity is None
            else f"<@{assignee_identity.external_id}>"
        )
    else:
        raise NotImplementedError

    return f"*Issue assigned to {assignee_text} by <@{identity.external_id}>*"


def build_action_text(
    identity: RpcIdentity, action: MessageAction, has_escalating: bool = False
) -> str | None:
    if action.name == "assign":
        selected_options = action.selected_options or []
        if not len(selected_options):
            return None
        assignee = selected_options[0]["value"]
        return build_assigned_text(identity, assignee)

    # Resolve actions have additional 'parameters' after ':'
    status = STATUSES.get((action.value or "").split(":", 1)[0])
    status = "archived" if status == "ignored" and has_escalating else status
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
    all_members = group.project.get_members_as_rpc_users()
    members = list({m.id: m for m in all_members}.values())
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
    text: str, actions: Sequence[Any], identity: RpcIdentity, has_escalating: bool = False
) -> str:
    return (
        text
        + "\n"
        + "\n".join(
            [
                action_text
                for action_text in [
                    build_action_text(identity, action, has_escalating) for action in actions
                ]
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
    identity: RpcIdentity | None = None,
) -> tuple[Sequence[MessageAction], str, str]:
    """Having actions means a button will be shown on the Slack message e.g. ignore, resolve, assign."""
    has_escalating = features.has("organizations:escalating-issues", project.organization)

    if actions and identity:
        text = get_action_text(text, actions, identity, has_escalating)
        return [], text, "_actioned_issue"

    ignore_button = MessageAction(
        name="status",
        label="Archive" if has_escalating else "Ignore",
        value="ignored:until_escalating" if has_escalating else "ignored:forever",
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
            value="unresolved:ongoing",
        )

    if status == GroupStatus.IGNORED:
        ignore_button = MessageAction(
            name="status",
            label="Mark as Ongoing" if has_escalating else "Stop Ignoring",
            value="unresolved:ongoing",
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
    if group.issue_category == GroupCategory.PERFORMANCE:
        # XXX(CEO): this shouldn't be needed long term, but due to a race condition
        # the group's latest event is not found and we end up with no event_for_tags here for perf issues
        return "info"

    return "error"


class SlackIssuesMessageBuilder(SlackMessageBuilder):
    """We're keeping around this awkward interface so that we can share logic with unfurling."""

    def __init__(
        self,
        group: Group,
        event: GroupEvent | None = None,
        tags: set[str] | None = None,
        identity: RpcIdentity | None = None,
        actions: Sequence[MessageAction] | None = None,
        rules: list[Rule] | None = None,
        link_to_event: bool = False,
        issue_details: bool = False,
        notification: ProjectNotification | None = None,
        recipient: RpcActor | None = None,
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

    @property
    def escape_text(self) -> bool:
        """
        Returns True if we need to escape the text in the message.
        """
        return features.has("organizations:slack-escape-messages", self.group.project.organization)

    def build(self) -> SlackBody:
        # XXX(dcramer): options are limited to 100 choices, even when nested
        text = build_attachment_text(self.group, self.event) or ""
        project = Project.objects.get_from_cache(id=self.group.project_id)

        # If an event is unspecified, use the tags of the latest event (if one exists).
        event_for_tags = self.event or self.group.get_latest_event()
        color = get_color(event_for_tags, self.notification, self.group)
        fields = build_tag_fields(event_for_tags, self.tags)
        footer = (
            self.notification.build_notification_footer(self.recipient, ExternalProviders.SLACK)
            if self.notification and self.recipient
            else build_footer(self.group, project, self.rules, SLACK_URL_FORMAT)
        )
        obj = self.event if self.event is not None else self.group
        if not self.issue_details or (
            self.recipient and self.recipient.actor_type == ActorType.TEAM
        ):
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


def build_group_attachment(
    group: Group,
    event: GroupEvent | None = None,
    tags: set[str] | None = None,
    identity: RpcIdentity | None = None,
    actions: Sequence[MessageAction] | None = None,
    rules: list[Rule] | None = None,
    link_to_event: bool = False,
    issue_details: bool = False,
) -> SlackBody:
    """@deprecated"""
    return SlackIssuesMessageBuilder(
        group, event, tags, identity, actions, rules, link_to_event, issue_details
    ).build()
