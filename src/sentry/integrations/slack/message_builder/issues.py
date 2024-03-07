from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from typing import Any

from django.utils import timezone
from django.utils.timesince import timesince
from django.utils.translation import gettext as _
from sentry_relay.processing import parse_release

from sentry import features, tagstore
from sentry.api.endpoints.group_details import get_group_global_count
from sentry.constants import LOG_LEVELS_MAP
from sentry.eventstore.models import GroupEvent
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
    CATEGORY_TO_EMOJI_V2,
    LEVEL_TO_EMOJI,
    LEVEL_TO_EMOJI_V2,
    SLACK_URL_FORMAT,
    SlackAttachment,
    SlackBlock,
)
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.utils.escape import escape_slack_markdown_text, escape_slack_text
from sentry.issues.grouptype import (
    GroupCategory,
    PerformanceP95EndpointRegressionGroupType,
    ProfileFunctionRegressionType,
)
from sentry.models.actor import ActorTuple
from sentry.models.commit import Commit
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.models.release import Release
from sentry.models.rule import Rule
from sentry.models.team import Team
from sentry.models.user import User
from sentry.notifications.notifications.base import ProjectNotification
from sentry.notifications.utils import get_commits
from sentry.notifications.utils.actions import MessageAction
from sentry.notifications.utils.participants import (
    dedupe_suggested_assignees,
    get_suspect_commit_users,
)
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.identity import RpcIdentity, identity_service
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.types.group import SUBSTATUS_TO_STR
from sentry.types.integrations import ExternalProviders
from sentry.utils import json

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


def get_approx_start_time(group: Group):
    event = group.get_recommended_event_for_environments()

    if event is None:
        return None

    occurrence = event.occurrence

    if occurrence is None:
        return None

    regression_time = occurrence.evidence_data.get("breakpoint", None)

    if regression_time is None:
        return None

    # format moment into YYYY-mm-dd h:m:s
    time = datetime.fromtimestamp(regression_time)
    return time.strftime("%Y-%m-%d %H:%M:%S")


# NOTE: if this starts getting large and functions get complicated,
# pull things out into their own functions
SUPPORTED_CONTEXT_DATA = {
    "Events": lambda group: get_group_global_count(group),
    "Users Affected": lambda group: group.count_users_seen(),
    "State": lambda group: SUBSTATUS_TO_STR.get(group.substatus, "").replace("_", " ").title(),
    "First Seen": lambda group: time_since(group.first_seen),
    "Approx. Start Time": get_approx_start_time,
}


REGRESSION_PERFORMANCE_ISSUE_TYPES = [
    PerformanceP95EndpointRegressionGroupType,
    ProfileFunctionRegressionType,
]

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


def format_release_tag(value: str, event: GroupEvent | Group):
    """Format the release tag using the short version and make it a link"""
    path = f"/releases/{value}/"
    url = event.project.organization.absolute_url(path)
    release_description = parse_release(value).get("description")
    return f"<{url}|{release_description}>"


def get_tags(
    group: Group,
    event_for_tags: Any,
    tags: set[str] | None = None,
) -> Sequence[Mapping[str, str | bool]]:
    """Get tag keys and values for block kit"""
    fields = []
    if not tags:
        tags = set()

    # XXX(CEO): context is passing tags as a list of tuples from self.event.tags
    # we should standardize but it might break other notifications
    if tags and isinstance(tags, list):
        tags = set(tags[0])

    default_tags = {"level", "release", "handled", "environment"}
    # for performance issues we want to have the default tags _except_ level
    if (
        group.issue_category == GroupCategory.PERFORMANCE
        and group.issue_type not in REGRESSION_PERFORMANCE_ISSUE_TYPES
    ):
        default_tags.remove("level")

    # XXX(CEO): in the short term we're not adding these to all issue types (e.g. crons, user feedback)
    # but in the future we'll read some config from the grouptype
    if group.issue_category not in [GroupCategory.ERROR, GroupCategory.PERFORMANCE] or (
        group.issue_category == GroupCategory.PERFORMANCE
        and group.issue_type in REGRESSION_PERFORMANCE_ISSUE_TYPES
    ):
        default_tags = set()

    use_improved_block_kit = features.has(
        "organizations:slack-block-kit-improvements", group.project.organization
    )
    # improved block kit only uses alert rule tags
    if not use_improved_block_kit:
        tags = tags | default_tags

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


def get_context(group: Group) -> str:
    context_text = ""
    use_improved_block_kit = features.has(
        "organizations:slack-block-kit-improvements", group.project.organization
    )

    # original block kit
    if not use_improved_block_kit:
        context = {
            "Events": get_group_global_count(group),
            "Users Affected": group.count_users_seen(),
            "State": SUBSTATUS_TO_STR.get(group.substatus, "").replace("_", " ").title(),
            "First Seen": time_since(group.first_seen),
        }
        if group.issue_type in REGRESSION_PERFORMANCE_ISSUE_TYPES:
            # another short term solution for non-error issues notification content
            return context_text

        if group.issue_category in [GroupCategory.ERROR, GroupCategory.PERFORMANCE]:
            for k, v in context.items():
                if k and v:
                    context_text += f"{k}: *{v}*   "

        return context_text.rstrip()

    # updated block kit
    context = group.issue_type.notification_config.context
    context_dict = {}

    for c in context:
        if c in SUPPORTED_CONTEXT_DATA:
            context_dict[c] = SUPPORTED_CONTEXT_DATA[c](group)

    # for errors, non-regression performance, and rage click issues
    # always show state and first seen
    # only show event count and user count if event count > 1 or state != new

    event_count = context_dict.get("Events")
    state = context_dict.get("State")
    if (event_count and int(event_count) <= 1) or (state and state == "New"):
        # filter out event count and users count
        context_dict.pop("Events", None)
        context_dict.pop("Users Affected", None)

    for k, v in context_dict.items():
        if v:
            context_text += f"{k}: *{v}*   "
    return context_text.rstrip()


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
    project: Project, event: GroupEvent, current_assignee: RpcUser | Team | None
) -> list[str]:
    """Get suggested assignees as a list of formatted strings"""
    suggested_assignees = []
    issue_owners, _ = ProjectOwnership.get_owners(project.id, event.data)
    if (
        issue_owners != ProjectOwnership.Everyone
    ):  # we don't want every user in the project to be a suggested assignee
        resolved_owners = ActorTuple.resolve_many(issue_owners)
        suggested_assignees = RpcActor.many_from_object(resolved_owners)
    try:
        suspect_commit_users = RpcActor.many_from_object(get_suspect_commit_users(project, event))
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
            if assignee.actor_type == ActorType.USER and not (
                isinstance(current_assignee, RpcUser) and assignee.id == current_assignee.id
            ):
                assignee_as_user = assignee.resolve()
                assignee_texts.append(assignee_as_user.get_display_name())
            elif assignee.actor_type == ActorType.TEAM and not (
                isinstance(current_assignee, Team) and assignee.id == current_assignee.id
            ):
                assignee_texts.append(f"#{assignee.slug}")
        return assignee_texts
    return []


def get_suspect_commit_text(
    project: Project, event: GroupEvent, commits: Sequence[Mapping[str, Any]] | None = None
) -> SlackBlock:
    """Build up the suspect commit text for the given event"""

    # commits is passed from context when the rule initially fires
    # we may not have that data if the message is being built after an action is taken, for example
    if not commits:
        commits = get_commits(project, event)
    if not commits:
        return None

    commit = commits[0]  # get the most recent commit
    suspect_commit_text = "Suspect Commit: "
    pull_request = commit.get("pull_request")
    author = commit.get("author")
    commit_id = commit.get("id")
    if not (author and commit_id):  # we need both the author and commit id to continue
        return None

    author_display = author.get("name") if author.get("name") is not None else author.get("email")
    if pull_request:
        repo = pull_request.get("repository", {})
        repo_base = repo.get("url")
        provider = repo.get("provider", {}).get("id")
        if repo_base and provider in SUPPORTED_COMMIT_PROVIDERS:
            if "bitbucket" in provider:
                commit_link = f"<{repo_base}/commits/{commit_id}"
            else:
                commit_link = f"<{repo_base}/commit/{commit_id}"
            commit_link += f"|{commit_id[:6]}>"
            suspect_commit_text += f"{commit_link} by {author_display}"
        else:  # for unsupported providers
            suspect_commit_text += f"{commit_id[:6]} by {author_display}"

        pr_date = pull_request.get("dateCreated")
        if pr_date:
            pr_date = time_since(pr_date)
        pr_id = pull_request.get("id")
        pr_title = pull_request.get("title")
        pr_link = pull_request.get("externalUrl")
        if pr_date and pr_id and pr_title and pr_link:
            suspect_commit_text += (
                f" {pr_date} \n'{pr_title} (#{pr_id})' <{pr_link}|View Pull Request>"
            )
    else:
        suspect_commit_text += f"{commit_id[:6]} by {author_display}"
    return suspect_commit_text


def get_action_text(text: str, actions: Sequence[Any], identity: RpcIdentity) -> str:
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

    def _ignore_button(use_block_kit) -> MessageAction | None:
        if group.issue_category == GroupCategory.FEEDBACK:
            return None
        if use_block_kit:
            if status == GroupStatus.IGNORED:
                return MessageAction(
                    name="status", label="Mark as Ongoing", value="unresolved:ongoing"
                )
            return MessageAction(name="status", label="Archive", value="archive_dialog")

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
            option_groups=(
                get_option_groups(group)
                if not use_block_kit
                else get_option_groups_block_kit(group)
            ),
        )
        return assign_button

    action_list = [
        a
        for a in [
            _resolve_button(use_block_kit),
            _ignore_button(use_block_kit),
            _assign_button(use_block_kit),
        ]
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
        notes: str | None = None,
        commits: Sequence[Mapping[str, Any]] | None = None,
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
        self.commits = commits
        self.use_improved_block_kit = features.has(
            "organizations:slack-block-kit-improvements", group.project.organization
        )

    @property
    def escape_text(self) -> bool:
        """
        Returns True if we need to escape the text in the message.
        """
        return True

    def build(self, notification_uuid: str | None = None) -> SlackBlock | SlackAttachment:
        # XXX(dcramer): options are limited to 100 choices, even when nested
        text = build_attachment_text(self.group, self.event) or ""
        text = text.strip(" \n")

        if self.use_improved_block_kit:
            text = escape_slack_markdown_text(text)
        if not self.use_improved_block_kit and self.escape_text:
            text = escape_slack_text(text)
            # XXX(scefali): Not sure why we actually need to do this just for unfurled messages.
            # If we figure out why this is required we should note it here because it's quite strange
            if self.is_unfurl:
                text = escape_slack_text(text)

        # This link does not contain user input (it's a static label and a url), must not escape it.
        replay_link = build_attachment_replay_link(self.group, self.event)
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
        action_text = ""

        if not self.issue_details or (
            self.recipient and self.recipient.actor_type == ActorType.TEAM
        ):
            payload_actions, action_text, color = build_actions(
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
            if replay_link:
                text += f"\n\n{replay_link}"
            if action_text and self.identity:
                text += "\n" + action_text

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
        title_text = f"<{title_link}|*{escape_slack_text(title)}*>"

        if self.group.issue_category == GroupCategory.ERROR:
            level_text = None
            for k, v in LOG_LEVELS_MAP.items():
                if self.group.level == v:
                    level_text = k

            if self.use_improved_block_kit:
                title_emoji = LEVEL_TO_EMOJI_V2.get(level_text)
            else:
                title_emoji = LEVEL_TO_EMOJI.get(level_text)
        else:
            if self.use_improved_block_kit:
                title_emoji = CATEGORY_TO_EMOJI_V2.get(self.group.issue_category)
            else:
                title_emoji = CATEGORY_TO_EMOJI.get(self.group.issue_category)

        if title_emoji:
            title_text = f"{title_emoji} {title_text}"
        blocks = [self.get_markdown_block(title_text)]

        # build up text block
        if text:
            text = text.lstrip(" ")
            # XXX(CEO): sometimes text is " " and slack will error if we pass an empty string (now "")
            if text:
                blocks.append(self.get_markdown_quote_block(text))

        # build up actions text
        if self.actions and self.identity and not action_text:
            action_text = get_action_text(text, self.actions, self.identity)

        if self.actions:
            blocks.append(self.get_markdown_block(action_text))

        # build tags block
        tags = get_tags(self.group, event_for_tags, self.tags)
        if tags:
            blocks.append(self.get_tags_block(tags))

        # add event count, user count, substate, first seen
        context = get_context(self.group)
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
                        action, format_actor_option(assignee, True) if assignee else None
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
            suggested_assignee_text = "Suggested Assignees: "
            for assignee in suggested_assignees:
                suggested_assignee_text += assignee + ", "
            blocks.append(
                self.get_context_block(suggested_assignee_text[:-2])
            )  # get rid of comma at the end

        # add suspect commit info
        if event_for_tags:
            suspect_commit_text = get_suspect_commit_text(project, event_for_tags, self.commits)
            if suspect_commit_text:
                blocks.append(self.get_context_block(suspect_commit_text))

        # add notes
        if self.notes:
            notes_text = f"notes: {self.notes}"
            blocks.append(self.get_markdown_block(notes_text))

        # build footer block
        timestamp = None
        if not self.issue_details:
            ts = self.group.last_seen
            timestamp = max(ts, self.event.datetime) if self.event else ts

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
            blocks.append(self.get_context_block(text=footer_text))
        else:
            blocks.append(self.get_context_block(text=footer, timestamp=timestamp))

        blocks.append(self.get_divider())

        block_id = {"issue": self.group.id}
        if rule_id:
            block_id["rule"] = rule_id

        return self._build_blocks(
            *blocks,
            fallback_text=self.build_fallback_text(obj, project.slug),
            block_id=json.dumps(block_id),
            skip_fallback=self.skip_fallback,
        )
