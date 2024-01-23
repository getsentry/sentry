from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Mapping, Sequence, Union

from django.utils import timezone
from django.utils.timesince import timesince
from django.utils.translation import gettext as _

from sentry import features, tagstore
from sentry.api.endpoints.group_details import get_group_global_count
from sentry.constants import LOG_LEVELS_MAP
from sentry.eventstore.models import Event, GroupEvent
from sentry.integrations.message_builder import (
    build_attachment_replay_link,
    build_attachment_text,
    build_attachment_title,
    build_footer,
    format_actor_option,
    format_actor_options,
    get_color,
    get_timestamp,
    get_title_link,
)
from sentry.integrations.slack.message_builder import (
    CATEGORY_TO_EMOJI,
    LEVEL_TO_EMOJI,
    SLACK_URL_FORMAT,
    SlackAttachment,
    SlackBlock,
)
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.utils.escape import escape_slack_text
from sentry.issues.grouptype import GroupCategory
from sentry.models.actor import ActorTuple
from sentry.models.commit import Commit
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.rule import Rule
from sentry.models.team import Team
from sentry.models.user import User
from sentry.notifications.notifications.base import ProjectNotification
from sentry.notifications.utils.actions import MessageAction
from sentry.notifications.utils.participants import (
    dedupe_suggested_assignees,
    get_owners,
    get_suspect_commit_users,
)
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.identity import RpcIdentity, identity_service
from sentry.types.group import SUBSTATUS_TO_STR
from sentry.types.integrations import ExternalProviders
from sentry.utils import json

STATUSES = {"resolved": "resolved", "ignored": "ignored", "unresolved": "re-opened"}
logger = logging.getLogger(__name__)


def time_since(value: datetime):
    """
    Display the relative time
    """
    now = timezone.now()
    if value < (now - timedelta(days=5)):
        return value.date()
    diff = timesince(value, now)
    if diff == timesince(now, now):
        return "Just now"
    if diff == "1 day":
        return _("Yesterday")
    return f"{diff} ago"


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
            filter={
                "provider_id": identity.idp_id,
                "user_id": assigned_actor.id,
            }
        )
        assignee_text = (
            assigned_actor.get_display_name()
            if assignee_identity is None
            else f"<@{assignee_identity.external_id}>"
        )
    else:
        raise NotImplementedError

    return f"*Issue assigned to {assignee_text} by <@{identity.external_id}>*"


def build_action_text(identity: RpcIdentity, action: MessageAction) -> str | None:
    if action.name == "assign":
        selected_options = action.selected_options or []
        if not len(selected_options):
            return None
        assignee = selected_options[0]["value"]
        return build_assigned_text(identity, assignee)

    # Resolve actions have additional 'parameters' after ':'
    status = STATUSES.get((action.value or "").split(":", 1)[0])
    status = "archived" if status == "ignored" else status
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
            std_key = tagstore.backend.get_standardized_key(key)
            if std_key not in tags:
                continue

            labeled_value = tagstore.backend.get_tag_value_label(key, value)
            fields.append(
                {
                    "title": std_key.encode("utf-8"),
                    "value": labeled_value.encode("utf-8"),
                    "short": True,
                }
            )
    return fields


def get_tags(
    event_for_tags: Any,
    tags: set[str] | None = None,
) -> Sequence[Mapping[str, str | bool]]:
    """Get tag keys and values for block kit"""
    fields = []
    if not tags:
        tags = set()

    # XXX(CEO): context is passing tags as a list of tuples from self.event.tags
    # we should standardize but it might break other notifications
    if tags and type(tags) is list:
        tags = set(tags[0])

    tags = tags | {"level", "release"}
    if tags:
        event_tags = event_for_tags.tags if event_for_tags else []
        for key, value in event_tags:
            std_key = tagstore.backend.get_standardized_key(key)
            if std_key not in tags:
                continue

            labeled_value = tagstore.backend.get_tag_value_label(key, value)
            fields.append(
                {
                    "title": std_key,
                    "value": labeled_value,
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


def get_option_groups_block_kit(group: Group) -> Sequence[Mapping[str, Any]]:
    all_members = group.project.get_members_as_rpc_users()
    members = list({m.id: m for m in all_members}.values())
    teams = group.project.teams.all()
    use_block_kit = features.has("organizations:slack-block-kit", group.project.organization)

    option_groups = []
    if teams:
        team_options = format_actor_options(teams, use_block_kit)
        option_groups.append(
            {"label": {"type": "plain_text", "text": "Teams"}, "options": team_options}
        )

    if members:
        member_options = format_actor_options(members, use_block_kit)
        option_groups.append(
            {"label": {"type": "plain_text", "text": "People"}, "options": member_options}
        )
    return option_groups


def get_group_assignees(group: Group) -> Sequence[Mapping[str, Any]]:
    """Get teams and users that can be issue assignees for block kit"""
    all_members = group.project.get_members_as_rpc_users()
    members = list({m.id: m for m in all_members}.values())
    teams = group.project.teams.all()

    option_groups = []
    if teams:
        for team in teams:
            option_groups.append({"label": team.slug, "value": f"team:{team.id}"})

    if members:
        for member in members:
            option_groups.append({"label": member.email, "value": f"user:{member.id}"})

    return option_groups


def get_suggested_assignees(
    identity: RpcIdentity | None, project: Project, event: Event
) -> list[str]:
    """Get suggested assignees as a list of formatted strings"""
    suggested_assignees, _ = get_owners(project, event, None)
    if features.has("organizations:streamline-targeting-context", project.organization):
        try:
            suspect_commit_users = RpcActor.many_from_object(
                get_suspect_commit_users(project, event)
            )
            suggested_assignees.extend(suspect_commit_users)
        except (Release.DoesNotExist, Commit.DoesNotExist):
            logger.info("Skipping suspect committers because release does not exist.")
        except Exception:
            logger.exception("Could not get suspect committers. Continuing execution.")
    if suggested_assignees:
        suggested_assignees = dedupe_suggested_assignees(suggested_assignees)
        assignee_texts = []
        for assignee in suggested_assignees:
            if assignee.actor_type == ActorType.USER:
                assignee_identity = None
                if identity:
                    assignee_identity = identity_service.get_identity(
                        filter={"provider_id": identity.idp_id, "user_id": assignee.id}
                    )
                if assignee_identity is None:
                    assignee_as_user = assignee.resolve()
                    assignee_text = (
                        f"<mailto:{assignee_as_user.email}|{assignee_as_user.get_display_name()}>"
                    )
                else:
                    assignee_text = f"<@{assignee_identity.external_id}>"
                assignee_texts.append(assignee_text)
            else:
                assignee_texts.append(f"#{assignee.slug}")
        return assignee_texts
    return []


def get_action_text(text: str, actions: Sequence[Any], identity: RpcIdentity) -> str:
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
    identity: RpcIdentity | None = None,
) -> tuple[Sequence[MessageAction], str, str]:
    """Having actions means a button will be shown on the Slack message e.g. ignore, resolve, assign."""
    use_block_kit = features.has("organizations:slack-block-kit", project.organization)

    if actions and identity:
        text = get_action_text(text, actions, identity)
        return [], text, "_actioned_issue"

    status = group.get_status()

    def _ignore_button() -> MessageAction:
        if group.issue_category == GroupCategory.FEEDBACK:
            return None

        if status == GroupStatus.IGNORED:
            return MessageAction(
                name="status",
                label="Mark as Ongoing",
                value="unresolved:ongoing",
            )

        return MessageAction(
            name="status",
            label="Archive",
            value="ignored:until_escalating",
        )

    def _resolve_button(use_block_kit) -> MessageAction:
        if use_block_kit:
            if status == GroupStatus.RESOLVED:
                return MessageAction(
                    name="unresolved:ongoing", label="Unresolve", value="unresolved:ongoing"
                )
            if not project.flags.has_releases:
                return MessageAction(name="status", label="Resolve", value="resolved")
            return MessageAction(
                name="status",
                label="Resolve",
                value="resolve_dialog",
            )

        if status == GroupStatus.RESOLVED:
            return MessageAction(
                name="status",
                label="Unresolve",
                value="unresolved:ongoing",
            )

        if not project.flags.has_releases:
            return MessageAction(
                name="status",
                label="Resolve",
                value="resolved",
            )
        return MessageAction(
            name="resolve_dialog",
            label="Resolve...",
            value="resolve_dialog",
        )

    def _assign_button(use_block_kit) -> MessageAction:
        assignee = group.get_assignee()
        assign_button = MessageAction(
            name="assign",
            label="Select Assignee...",
            type="select",
            selected_options=format_actor_options([assignee]) if assignee else [],
            option_groups=get_option_groups(group)
            if not use_block_kit
            else get_option_groups_block_kit(group),
        )
        return assign_button

    action_list = [
        a
        for a in [_resolve_button(use_block_kit), _ignore_button(), _assign_button(use_block_kit)]
        if a is not None
    ]

    return action_list, text, color


class SlackIssuesMessageBuilder(BlockSlackMessageBuilder):
    """Build an issue alert notification for Slack"""

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
        is_unfurl: bool = False,
        skip_fallback: bool = False,
        mentions: str | None = None,
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
        self.is_unfurl = is_unfurl
        self.skip_fallback = skip_fallback
        self.mentions = mentions

    @property
    def escape_text(self) -> bool:
        """
        Returns True if we need to escape the text in the message.
        """
        return True

    def build(self, notification_uuid: str | None = None) -> Union[SlackBlock, SlackAttachment]:
        # XXX(dcramer): options are limited to 100 choices, even when nested
        text = build_attachment_text(self.group, self.event) or ""

        if self.escape_text:
            text = escape_slack_text(text)
            # XXX(scefali): Not sure why we actually need to do this just for unfurled messages.
            # If we figure out why this is required we should note it here because it's quite strange
            if self.is_unfurl:
                text = escape_slack_text(text)

        # This link does not contain user input (it's a static label and a url), must not escape it.
        text += build_attachment_replay_link(self.group, self.event) or ""

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

        rule_id = None
        if self.rules:
            rule_id = self.rules[0].id

        title_link = get_title_link(
            self.group,
            self.event,
            self.link_to_event,
            self.issue_details,
            self.notification,
            ExternalProviders.SLACK,
            rule_id,
            notification_uuid=notification_uuid,
        )
        title = build_attachment_title(obj)

        if not features.has("organizations:slack-block-kit", self.group.project.organization):
            return self._build(
                actions=payload_actions,
                callback_id=json.dumps({"issue": self.group.id}),
                color=color,
                fallback=self.build_fallback_text(obj, project.slug),
                fields=fields,
                footer=footer,
                text=text,
                title=title,
                title_link=title_link,
                ts=get_timestamp(self.group, self.event) if not self.issue_details else None,
            )

        # build up the blocks for newer issue alert formatting #

        # build title block
        if text and not self.actions:
            text = f"```{text.lstrip(' ')}```"
        title_text = f"<{title_link}|*{escape_slack_text(title)}*>  \n{text}"

        if self.group.issue_category == GroupCategory.ERROR:
            level_text = None
            for k, v in LOG_LEVELS_MAP.items():
                if self.group.level == v:
                    level_text = k

            title_emoji = LEVEL_TO_EMOJI.get(level_text)
        else:
            title_emoji = CATEGORY_TO_EMOJI.get(self.group.issue_category)

        if title_emoji:
            title_text = f"{title_emoji} {title_text}"

        blocks = [self.get_markdown_block(title_text)]
        # build tags block
        tags = get_tags(event_for_tags, self.tags)
        if tags:
            blocks.append(self.get_tags_block(tags))

        # add event count, user count, substate, first seen
        context = {
            "Events": get_group_global_count(self.group),
            "Users Affected": self.group.count_users_seen(),
            "State": SUBSTATUS_TO_STR.get(self.group.substatus, "").title(),
            "First Seen": time_since(self.group.first_seen),
        }
        context_text = ""
        for k, v in context.items():
            if k and v:
                context_text += f"{k}: *{v}*   "
        blocks.append(self.get_markdown_block(context_text[:-3]))

        # build actions
        actions = []
        for action in payload_actions:
            if action.label in (
                "Archive",
                "Ignore",
                "Mark as Ongoing",
                "Stop Ignoring",
                "Resolve",
                "Unresolve",
                "Resolve...",
            ):
                actions.append(self.get_button_action(action))
            elif action.name == "assign":
                assignee = self.group.get_assignee()
                actions.append(
                    self.get_external_select_action(
                        action, format_actor_option(assignee, True) if assignee else None
                    )
                )

        if actions:
            action_block = {"type": "actions", "elements": [action for action in actions]}
            blocks.append(action_block)

        # suggested assignees
        suggested_assignees = get_suggested_assignees(self.identity, self.group.project, self.event)
        if len(suggested_assignees) > 0:
            suggested_assignee_text = "Suggested Assignees: "
            for idx, assignee in enumerate(suggested_assignees):
                if idx != 0:
                    suggested_assignee_text += ", "
                suggested_assignee_text += assignee
            blocks.append(self.get_context_block(suggested_assignee_text))

        # add mentions
        if self.mentions:
            mentions_text = f"Mentions: {self.mentions}"
            blocks.append(self.get_markdown_block(mentions_text))

        # build footer block
        timestamp = None
        if not self.issue_details:
            ts = self.group.last_seen
            timestamp = max(ts, self.event.datetime) if self.event else ts

        if not self.notification:
            # the footer content differs if it's a workflow notification, so we must check for that
            footer = f"Project: <{project.get_absolute_url()}|{escape_slack_text(project.slug)}>    Alert: {footer}"
            blocks.append(self.get_context_block(text=footer))
        else:
            blocks.append(self.get_context_block(text=footer, timestamp=timestamp))

        blocks.append(self.get_divider())

        return self._build_blocks(
            *blocks,
            fallback_text=self.build_fallback_text(obj, project.slug),
            block_id=json.dumps({"issue": self.group.id}),
            skip_fallback=self.skip_fallback,
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
    is_unfurl: bool = False,
    notification_uuid: str | None = None,
    mentions: str | None = None,
) -> Union[SlackBlock, SlackAttachment]:

    return SlackIssuesMessageBuilder(
        group,
        event,
        tags,
        identity,
        actions,
        rules,
        link_to_event,
        issue_details,
        is_unfurl=is_unfurl,
        mentions=mentions,
    ).build(notification_uuid=notification_uuid)
