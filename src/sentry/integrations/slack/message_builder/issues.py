from __future__ import annotations

import logging
from collections.abc import Callable, Mapping, Sequence
from datetime import datetime
from typing import Any, TypedDict

import orjson
from django.core.exceptions import ObjectDoesNotExist
from sentry_relay.processing import parse_release

from sentry import tagstore
from sentry.constants import LOG_LEVELS
from sentry.eventstore.models import Event, GroupEvent
from sentry.identity.services.identity import RpcIdentity, identity_service
from sentry.integrations.messaging.message_builder import (
    build_attachment_replay_link,
    build_attachment_text,
    build_attachment_title,
    build_footer,
    format_actor_option_slack,
    format_actor_options_slack,
    get_title_link,
)
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.message_builder.image_block_builder import ImageBlockBuilder
from sentry.integrations.slack.message_builder.types import (
    ACTION_EMOJI,
    ACTIONED_CATEGORY_TO_EMOJI,
    CATEGORY_TO_EMOJI,
    LEVEL_TO_EMOJI,
    SLACK_URL_FORMAT,
    SlackBlock,
)
from sentry.integrations.slack.utils.escape import escape_slack_markdown_text, escape_slack_text
from sentry.integrations.time_utils import get_approx_start_time, time_since
from sentry.integrations.types import ExternalProviders
from sentry.issues.endpoints.group_details import get_group_global_count
from sentry.issues.grouptype import GroupCategory, NotificationContextField
from sentry.models.commit import Commit
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.models.pullrequest import PullRequest
from sentry.models.release import Release
from sentry.models.repository import Repository
from sentry.models.rule import Rule
from sentry.models.team import Team
from sentry.notifications.notifications.base import ProjectNotification
from sentry.notifications.utils.actions import BlockKitMessageAction, MessageAction
from sentry.notifications.utils.participants import (
    dedupe_suggested_assignees,
    get_suspect_commit_users,
)
from sentry.snuba.referrer import Referrer
from sentry.types.actor import Actor
from sentry.types.group import SUBSTATUS_TO_STR
from sentry.users.services.user.model import RpcUser

STATUSES = {"resolved": "resolved", "ignored": "ignored", "unresolved": "re-opened"}
SUPPORTED_COMMIT_PROVIDERS = (
    "github",
    "integrations:github",
    "integrations:github_enterprise",
    "integrations:vsts",
    "integrations:gitlab",
    "bitbucket",
    "integrations:bitbucket",
)

MAX_BLOCK_TEXT_LENGTH = 256
USER_FEEDBACK_MAX_BLOCK_TEXT_LENGTH = 1500


def get_group_users_count(group: Group, rules: list[Rule] | None = None) -> int:
    environment_ids: list[int] | None = None
    if rules:
        environment_ids = [rule.environment_id for rule in rules if rule.environment_id is not None]
        if not environment_ids:
            environment_ids = None

    return group.count_users_seen(
        referrer=Referrer.TAGSTORE_GET_GROUPS_USER_COUNTS_SLACK_ISSUE_NOTIFICATION.value,
        environment_ids=environment_ids,
    )


# NOTE: if this starts getting large and functions get complicated,
# pull things out into their own functions
SUPPORTED_CONTEXT_DATA: dict[NotificationContextField, Callable] = {
    NotificationContextField.EVENTS: lambda group, rules: get_group_global_count(group),
    NotificationContextField.USERS_AFFECTED: get_group_users_count,
    NotificationContextField.STATE: lambda group, rules: SUBSTATUS_TO_STR.get(group.substatus, "")
    .replace("_", " ")
    .title(),
    NotificationContextField.FIRST_SEEN: lambda group, rules: time_since(group.first_seen),
    NotificationContextField.APPROX_START_TIME: lambda group, rules: datetime.fromtimestamp(
        get_approx_start_time(group=group)
    ).strftime(
        "%Y-%m-%d %H:%M:%S"
    ),  # format moment into YYYY-mm-dd h:m:s
}


logger = logging.getLogger(__name__)


def build_assigned_text(identity: RpcIdentity, assignee: str) -> str | None:
    actor = Actor.from_identifier(assignee)

    try:
        assigned_actor = actor.resolve()
    except ObjectDoesNotExist:
        return None

    if isinstance(assigned_actor, Team):
        assignee_text = f"#{assigned_actor.slug}"
    elif isinstance(assigned_actor, RpcUser):
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


def build_action_text(
    identity: RpcIdentity, action: MessageAction | BlockKitMessageAction
) -> str | None:
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


def format_release_tag(value: str, event: Event | GroupEvent | None) -> str:
    """Format the release tag using the short version and make it a link"""
    if not event:
        return ""

    path = f"/releases/{value}/"
    url = event.project.organization.absolute_url(path)
    release_description = parse_release(value, json_loads=orjson.loads).get("description")
    return f"<{url}|{release_description}>"


def get_tags(
    event_for_tags: Event | GroupEvent | None,
    tags: set[str] | list[tuple[str]] | None = None,
) -> Sequence[Mapping[str, str | bool]]:
    """Get tag keys and values for block kit"""
    fields = []
    if not tags:
        tags = set()

    # XXX(CEO): context is passing tags as a list of tuples from self.event.tags
    # we should standardize but it might break other notifications
    if tags and isinstance(tags, list):
        tags = set(tags[0])

    if tags:
        event_tags = event_for_tags.tags if event_for_tags else []
        for key, value in event_tags:
            std_key = tagstore.backend.get_standardized_key(key)
            if std_key not in tags:
                continue
            labeled_value = tagstore.backend.get_tag_value_label(key, value)
            if std_key == "release":
                labeled_value = format_release_tag(labeled_value, event_for_tags)
            fields.append(
                {
                    "title": std_key,
                    "value": labeled_value,
                }
            )
    return fields


def get_context(group: Group, rules: list[Rule] | None = None) -> str:
    context_text = ""

    context = group.issue_type.notification_config.context.copy()

    # for errors, non-regression performance, and rage click issues
    # always show state and first seen
    # only show event count and user count if event count > 1 or state != new

    state = None
    event_count = None
    if NotificationContextField.STATE in context:
        state = SUPPORTED_CONTEXT_DATA[NotificationContextField.STATE](group, rules)
    if NotificationContextField.EVENTS in context:
        event_count = SUPPORTED_CONTEXT_DATA[NotificationContextField.EVENTS](group, rules)

    if (state and state == "New") or (event_count and int(event_count) <= 1):
        if NotificationContextField.EVENTS in context:
            context.remove(NotificationContextField.EVENTS)

        # avoid hitting Snuba for user count if we don't need it
        if NotificationContextField.USERS_AFFECTED in context:
            context.remove(NotificationContextField.USERS_AFFECTED)

    for c in context:
        if c in SUPPORTED_CONTEXT_DATA:
            v = SUPPORTED_CONTEXT_DATA[c](group, rules)
            if v:
                context_text += f"{c}: *{v}*   "

    return context_text.rstrip()


class OptionGroup(TypedDict):
    label: Mapping[str, str]
    options: Sequence[Mapping[str, Any]]


def get_option_groups(group: Group) -> Sequence[OptionGroup]:
    all_members = group.project.get_members_as_rpc_users()
    members = list({m.id: m for m in all_members}.values())
    teams = group.project.teams.all()

    option_groups = []
    if teams:
        team_option_group: OptionGroup = {
            "label": {"type": "plain_text", "text": "Teams"},
            "options": format_actor_options_slack(teams),
        }
        option_groups.append(team_option_group)

    if members:
        member_option_group: OptionGroup = {
            "label": {"type": "plain_text", "text": "People"},
            "options": format_actor_options_slack(members),
        }
        option_groups.append(member_option_group)
    return option_groups


def get_suggested_assignees(
    project: Project, event: Event | GroupEvent, current_assignee: RpcUser | Team | None
) -> list[str]:
    """Get suggested assignees as a list of formatted strings"""
    suggested_assignees = []
    issue_owners, _ = ProjectOwnership.get_owners(project.id, event.data)
    if (
        issue_owners != ProjectOwnership.Everyone
    ):  # we don't want every user in the project to be a suggested assignee
        suggested_assignees = issue_owners
    try:
        suspect_commit_users = Actor.many_from_object(get_suspect_commit_users(project, event))
        suggested_assignees.extend(suspect_commit_users)
    except (Release.DoesNotExist, Commit.DoesNotExist):
        logger.info("Skipping suspect committers because release does not exist.")
    except Exception:
        logger.exception("Could not get suspect committers. Continuing execution.")

    if suggested_assignees:
        suggested_assignees = dedupe_suggested_assignees(suggested_assignees)
        assignee_texts = []

        for assignee in suggested_assignees:
            # skip over any suggested assignees that are the current assignee of the issue, if there is any
            if assignee.is_team and not (
                isinstance(current_assignee, Team) and assignee.id == current_assignee.id
            ):
                assignee_texts.append(f"#{assignee.slug}")
            elif assignee.is_user and not (
                isinstance(current_assignee, RpcUser) and assignee.id == current_assignee.id
            ):
                assignee_as_user = assignee.resolve()
                if isinstance(assignee_as_user, RpcUser):
                    assignee_texts.append(assignee_as_user.get_display_name())
        return assignee_texts
    return []


def get_suspect_commit_text(group: Group) -> str | None:
    """Build up the suspect commit text for the given event"""

    commit = group.get_suspect_commit()
    if not commit:
        return None

    suspect_commit_text = "Suspect Commit: "

    author = commit.author
    commit_id = commit.key
    if not (author and commit_id):  # we need both the author and commit id to continue
        return None

    author_display = author.name if author.name else author.email
    pull_request = PullRequest.objects.filter(
        merge_commit_sha=commit.key, organization_id=group.project.organization_id
    ).first()
    if pull_request:
        repo = Repository.objects.get(id=pull_request.repository_id)
        repo_base = repo.url
        provider = repo.provider
        if repo_base and provider in SUPPORTED_COMMIT_PROVIDERS:
            if "bitbucket" in provider:
                commit_link = f"<{repo_base}/commits/{commit_id}"
            else:
                commit_link = f"<{repo_base}/commit/{commit_id}"
            commit_link += f"|{commit_id[:6]}>"
            suspect_commit_text += f"{commit_link} by {author_display}"
        else:  # for unsupported providers
            suspect_commit_text += f"{commit_id[:6]} by {author_display}"

        pr_date = pull_request.date_added
        if pr_date:
            pr_date = time_since(pr_date)
        pr_id = pull_request.key
        pr_title = pull_request.title
        pr_link = pull_request.get_external_url()
        if pr_date and pr_id and pr_title and pr_link:
            suspect_commit_text += (
                f" {pr_date} \n'{pr_title} (#{pr_id})' <{pr_link}|View Pull Request>"
            )
    else:
        suspect_commit_text += f"{commit_id[:6]} by {author_display}"
    return suspect_commit_text


def get_action_text(actions: Sequence[Any], identity: RpcIdentity) -> str:
    action_text = "\n".join(
        [
            action_text
            for action_text in [build_action_text(identity, action) for action in actions]
            if action_text
        ]
    )
    return action_text


def build_actions(
    group: Group,
    project: Project,
    text: str,
    actions: Sequence[MessageAction | BlockKitMessageAction] | None = None,
    identity: RpcIdentity | None = None,
) -> tuple[Sequence[MessageAction], str, bool]:
    """Having actions means a button will be shown on the Slack message e.g. ignore, resolve, assign."""
    if actions and identity:
        text = get_action_text(actions, identity)
        return [], text, True

    status = group.get_status()

    def _ignore_button() -> MessageAction | None:
        if group.issue_category == GroupCategory.FEEDBACK:
            return None
        if status == GroupStatus.IGNORED:
            return MessageAction(name="status", label="Mark as Ongoing", value="unresolved:ongoing")

        return MessageAction(name="status", label="Archive", value="archive_dialog")

    def _resolve_button() -> MessageAction:
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

    def _assign_button() -> MessageAction:
        assignee = group.get_assignee()
        assign_button = MessageAction(
            name="assign",
            label="Select Assignee...",
            type="select",
            selected_options=format_actor_options_slack([assignee]) if assignee else [],
            option_groups=get_option_groups(group),
        )
        return assign_button

    action_list = [
        a
        for a in [
            _resolve_button(),
            _ignore_button(),
            _assign_button(),
        ]
        if a is not None
    ]

    return action_list, text, False


class SlackIssuesMessageBuilder(BlockSlackMessageBuilder):
    """Build an issue alert notification for Slack"""

    def __init__(
        self,
        group: Group,
        event: Event | GroupEvent | None = None,
        tags: set[str] | None = None,
        identity: RpcIdentity | None = None,
        actions: Sequence[MessageAction | BlockKitMessageAction] | None = None,
        rules: list[Rule] | None = None,
        link_to_event: bool = False,
        issue_details: bool = False,
        notification: ProjectNotification | None = None,
        recipient: Actor | None = None,
        is_unfurl: bool = False,
        skip_fallback: bool = False,
        notes: str | None = None,
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
        self.notes = notes

    def get_title_block(
        self,
        event_or_group: Event | GroupEvent | Group,
        has_action: bool,
        rule_id: int | None = None,
        notification_uuid: str | None = None,
    ) -> SlackBlock:
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
        title = build_attachment_title(event_or_group)

        is_error_issue = self.group.issue_category == GroupCategory.ERROR
        title_emoji = None
        if has_action:
            # if issue is resolved, archived, or assigned, replace circle emojis with white circle
            title_emoji = (
                ACTION_EMOJI
                if is_error_issue
                else ACTIONED_CATEGORY_TO_EMOJI.get(self.group.issue_category)
            )
        elif is_error_issue:
            level_text = LOG_LEVELS[self.group.level]
            title_emoji = LEVEL_TO_EMOJI.get(level_text)
        else:
            title_emoji = CATEGORY_TO_EMOJI.get(self.group.issue_category)

        title_emoji = title_emoji + " " if title_emoji else ""
        title_text = title_emoji + f"<{title_link}|*{escape_slack_text(title)}*>"

        return self.get_markdown_block(title_text)

    def get_culprit_block(self, event_or_group: Event | GroupEvent | Group) -> SlackBlock | None:
        if event_or_group.culprit and isinstance(event_or_group.culprit, str):
            return self.get_context_block(event_or_group.culprit)
        return None

    def get_text_block(self, text) -> SlackBlock:
        if self.group.issue_category == GroupCategory.FEEDBACK:
            max_block_text_length = USER_FEEDBACK_MAX_BLOCK_TEXT_LENGTH
        else:
            max_block_text_length = MAX_BLOCK_TEXT_LENGTH

        return self.get_markdown_quote_block(text, max_block_text_length)

    def get_suggested_assignees_block(self, suggested_assignees: list[str]) -> SlackBlock:
        suggested_assignee_text = "Suggested Assignees: "
        for assignee in suggested_assignees:
            suggested_assignee_text += assignee + ", "
        return self.get_context_block(suggested_assignee_text[:-2])  # get rid of comma at the end

    def get_footer(self) -> SlackBlock:
        # This link does not contain user input (it's a static label and a url), must not escape it.
        replay_link = build_attachment_replay_link(self.group, self.event)

        timestamp = None
        if not self.issue_details:
            ts = self.group.last_seen
            timestamp = max(ts, self.event.datetime) if self.event else ts

        project = Project.objects.get_from_cache(id=self.group.project_id)
        footer = (
            self.notification.build_notification_footer(self.recipient, ExternalProviders.SLACK)
            if self.notification and self.recipient
            else build_footer(self.group, project, self.rules, SLACK_URL_FORMAT)
        )

        if not self.notification:
            # the footer content differs if it's a workflow notification, so we must check for that
            footer_data = {
                "Project": f"<{project.get_absolute_url()}|{escape_slack_text(project.slug)}>",
                "Alert": footer,
                "Short ID": self.group.qualified_short_id,
            }
            footer_text = ""
            for k, v in footer_data.items():
                footer_text += f"{k}: {v}    "

            if replay_link:
                footer_text += replay_link
            else:
                footer_text = footer_text[:-4]  # chop off the empty space
            return self.get_context_block(text=footer_text)
        else:
            return self.get_context_block(text=footer, timestamp=timestamp)

    def build(self, notification_uuid: str | None = None) -> SlackBlock:
        # XXX(dcramer): options are limited to 100 choices, even when nested
        text = build_attachment_text(self.group, self.event) or ""
        text = text.strip(" \n")

        text = escape_slack_markdown_text(text)

        project = Project.objects.get_from_cache(id=self.group.project_id)

        # If an event is unspecified, use the tags of the latest event (if one exists).
        event_for_tags = self.event or self.group.get_latest_event()

        event_or_group: Group | Event | GroupEvent = (
            self.event if self.event is not None else self.group
        )

        action_text = ""

        if not self.issue_details or (self.recipient and self.recipient.is_team):
            payload_actions, action_text, has_action = build_actions(
                self.group, project, text, self.actions, self.identity
            )
        else:
            payload_actions = []
            has_action = False

        rule_id = None
        if self.rules:
            rule_id = self.rules[0].id

        # build up actions text
        if self.actions and self.identity and not action_text:
            # this means somebody is interacting with the message
            action_text = get_action_text(self.actions, self.identity)
            has_action = True

        blocks = [self.get_title_block(event_or_group, has_action, rule_id, notification_uuid)]

        if culprit_block := self.get_culprit_block(event_or_group):
            blocks.append(culprit_block)

        # build up text block
        text = text.lstrip(" ")
        # XXX(CEO): sometimes text is " " and slack will error if we pass an empty string (now "")
        if text:
            blocks.append(self.get_text_block(text))

        if self.actions:
            blocks.append(self.get_markdown_block(action_text))

        # set up block id
        block_id = {"issue": self.group.id}
        if rule_id:
            block_id["rule"] = rule_id

        # build tags block
        tags = get_tags(event_for_tags=event_for_tags, tags=self.tags)
        if tags:
            blocks.append(self.get_tags_block(tags, block_id))

        # add event count, user count, substate, first seen
        context = get_context(self.group, self.rules)
        if context:
            blocks.append(self.get_context_block(context))

        # build actions
        actions = []
        assignee = self.group.get_assignee()
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
                actions.append(
                    self.get_external_select_action(
                        action, format_actor_option_slack(assignee) if assignee else None
                    )
                )

        if actions:
            action_block = {"type": "actions", "elements": [action for action in actions]}
            blocks.append(action_block)

        # suggested assignees
        suggested_assignees = []
        if event_for_tags:
            suggested_assignees = get_suggested_assignees(
                self.group.project, event_for_tags, assignee
            )
        if len(suggested_assignees) > 0:
            blocks.append(self.get_suggested_assignees_block(suggested_assignees))

        # add suspect commit info
        suspect_commit_text = get_suspect_commit_text(self.group)
        if suspect_commit_text:
            blocks.append(self.get_context_block(suspect_commit_text))

        # add notes
        if self.notes:
            notes_text = f"notes: {self.notes}"
            blocks.append(self.get_markdown_block(notes_text))

        # build footer block
        blocks.append(self.get_footer())
        blocks.append(self.get_divider())

        chart_block = ImageBlockBuilder(group=self.group).build_image_block()
        if chart_block:
            blocks.append(chart_block)

        return self._build_blocks(
            *blocks,
            fallback_text=self.build_fallback_text(event_or_group, project.slug),
            block_id=orjson.dumps(block_id).decode(),
            skip_fallback=self.skip_fallback,
        )
