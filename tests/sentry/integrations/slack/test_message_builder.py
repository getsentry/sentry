from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import Mock, patch

import orjson
from django.urls import reverse
from urllib3.response import HTTPResponse

from sentry.eventstore.models import Event
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
)
from sentry.incidents.models.incident import IncidentStatus
from sentry.integrations.messaging.message_builder import (
    build_attachment_text,
    build_attachment_title,
)
from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder
from sentry.integrations.slack.message_builder.issues import (
    SlackIssuesMessageBuilder,
    build_actions,
    format_release_tag,
    get_context,
    get_option_groups,
    get_tags,
)
from sentry.integrations.slack.message_builder.metric_alerts import SlackMetricAlertMessageBuilder
from sentry.integrations.slack.message_builder.types import LEVEL_TO_COLOR
from sentry.integrations.time_utils import time_since
from sentry.issues.grouptype import (
    FeedbackGroup,
    MonitorIncidentType,
    PerformanceP95EndpointRegressionGroupType,
    ProfileFileIOGroupType,
)
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.projectownership import ProjectOwnership
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.models.rule import Rule as IssueAlertRule
from sentry.models.team import Team
from sentry.notifications.utils.actions import MessageAction
from sentry.ownership.grammar import Matcher, Owner, Rule, dump_schema
from sentry.seer.anomaly_detection.types import StoreDataResponse
from sentry.silo.base import SiloMode
from sentry.testutils.cases import PerformanceIssueTestCase, TestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.types.actor import Actor
from sentry.types.group import GroupSubStatus
from sentry.users.models.user import User
from sentry.utils.http import absolute_uri
from tests.sentry.issues.test_utils import OccurrenceTestMixin

pytestmark = [requires_snuba]


def build_test_message_blocks(
    teams: set[Team],
    users: set[User],
    group: Group,
    event: Event | None = None,
    link_to_event: bool = False,
    tags: dict[str, str] | None = None,
    suggested_assignees: str | None = None,
    initial_assignee: Team | User | None = None,
    notes: str | None = None,
    suspect_commit_text: str | None = None,
) -> dict[str, Any]:
    project = group.project

    title = build_attachment_title(group)
    text = build_attachment_text(group)
    title_link = f"http://testserver/organizations/{project.organization.slug}/issues/{group.id}"
    formatted_title = title
    if event:
        title = event.title
        if title == "<unlabeled event>":
            formatted_title = "&lt;unlabeled event&gt;"
        if link_to_event:
            title_link += f"/events/{event.event_id}"
    title_link += "/?referrer=slack"
    title_text = f":red_circle: <{title_link}|*{formatted_title}*>"

    blocks: list[dict[str, Any]] = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": title_text},
            "block_id": f'{{"issue":{group.id}}}',
        },
    ]
    if group.culprit:
        blocks.append(
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"{group.culprit}",
                    }
                ],
            }
        )
    if text:
        new_text = text.lstrip(" ")
        if new_text:
            markdown_text = "```" + new_text + "```"
            text_section = {"type": "section", "text": {"type": "mrkdwn", "text": markdown_text}}
            blocks.append(text_section)

    tags_text = ""
    if tags:
        for k, v in tags.items():
            if k == "release":
                event_for_tags = group.get_latest_event()
                v = format_release_tag(v, event_for_tags)
            v = v.replace("`", "")
            tags_text += f"{k}: `{v}`  "

        tags_section = {
            "block_id": f'{{"issue":{group.id},"block":"tags"}}',
            "type": "section",
            "text": {"type": "mrkdwn", "text": tags_text},
        }
        blocks.append(tags_section)

    # add event and user count, state, first seen
    counts_section = {
        "type": "context",
        "elements": [
            {
                "type": "mrkdwn",
                "text": f"State: *New*   First Seen: *{time_since(group.first_seen)}*",
            }
        ],
    }

    blocks.append(counts_section)

    actions: dict[str, Any] = {
        "type": "actions",
        "elements": [
            {
                "type": "button",
                "action_id": "resolve_dialog",
                "text": {"type": "plain_text", "text": "Resolve"},
                "value": "resolve_dialog",
            },
            {
                "type": "button",
                "action_id": "archive_dialog",
                "text": {"type": "plain_text", "text": "Archive"},
                "value": "archive_dialog",
            },
            {
                "type": "external_select",
                "placeholder": {
                    "type": "plain_text",
                    "text": "Select Assignee...",
                    "emoji": True,
                },
                "action_id": "assign",
            },
        ],
    }
    if initial_assignee:
        if isinstance(initial_assignee, User):
            actions["elements"][2]["initial_option"] = {
                "text": {"type": "plain_text", "text": f"{initial_assignee.email}"},
                "value": f"user:{initial_assignee.id}",
            }
        else:
            actions["elements"][2]["initial_option"] = {
                "text": {"type": "plain_text", "text": f"#{initial_assignee.slug}"},
                "value": f"team:{initial_assignee.id}",
            }
    blocks.append(actions)

    if suggested_assignees:
        suggested_assignees_text = f"Suggested Assignees: {suggested_assignees}"
        suggested_assignees_section = {
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": suggested_assignees_text}],
        }
        blocks.append(suggested_assignees_section)

    if suspect_commit_text and event:
        suspect_commit_section = {
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": suspect_commit_text}],
        }
        blocks.append(suspect_commit_section)

    if notes:
        notes_text = f"notes: {notes}"
        notes_section = {
            "type": "section",
            "text": {"type": "mrkdwn", "text": notes_text},
        }
        blocks.append(notes_section)

    context_text = f"Project: <http://testserver/organizations/{project.organization.slug}/issues/?project={project.id}|{project.slug}>    Alert: BAR-{group.short_id}    Short ID: {group.qualified_short_id}"
    context = {
        "type": "context",
        "elements": [{"type": "mrkdwn", "text": context_text}],
    }
    blocks.append(context)

    blocks.append({"type": "divider"})

    popup_text = (
        f"[{project.slug}] {title}: {text}" if text is not None else f"[{project.slug}] {title}"
    )
    return {
        "blocks": blocks,
        "text": popup_text,
    }


class BuildGroupAttachmentTest(TestCase, PerformanceIssueTestCase, OccurrenceTestMixin):
    def test_build_group_block(self):
        release = self.create_release(project=self.project)
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "tags": {"escape": "`room`", "foo": "bar"},
                "timestamp": before_now(minutes=1).isoformat(),
                "logentry": {"formatted": "bar"},
                "_meta": {"logentry": {"formatted": {"": {"err": ["some error"]}}}},
                "release": release.version,
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        group = event.group
        assert group
        self.project.flags.has_releases = True
        self.project.save(update_fields=["flags"])
        more_tags = {"escape": "`room`", "foo": "bar", "release": release.version}
        notes = "hey @colleen fix it"

        assert SlackIssuesMessageBuilder(group).build() == build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
        )
        # add extra tag to message
        assert SlackIssuesMessageBuilder(
            group, event.for_group(group), tags={"foo", "escape", "release"}
        ).build() == build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
            tags=more_tags,
            event=event,
        )

        # add notes to message
        assert SlackIssuesMessageBuilder(
            group, event.for_group(group), notes=notes
        ).build() == build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
            notes=notes,
            event=event,
        )
        # add extra tag and notes to message
        assert SlackIssuesMessageBuilder(
            group, event.for_group(group), tags={"foo", "escape", "release"}, notes=notes
        ).build() == build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
            tags=more_tags,
            notes=notes,
            event=event,
        )

        assert SlackIssuesMessageBuilder(
            group, event.for_group(group)
        ).build() == build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
            event=event,
        )

        assert SlackIssuesMessageBuilder(
            group, event.for_group(group), link_to_event=True
        ).build() == build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
            event=event,
            link_to_event=True,
        )

        test_message = build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
        )

        assert SlackIssuesMessageBuilder(group).build() == test_message

    def test_build_group_block_with_message(self):
        event_data = {
            "event_id": "a" * 32,
            "message": "IntegrationError",
            "fingerprint": ["group-1"],
            "exception": {
                "values": [
                    {
                        "type": "IntegrationError",
                        "value": "Identity not found.",
                    }
                ]
            },
        }
        event = self.store_event(
            data=event_data,
            project_id=self.project.id,
        )
        assert event.group
        group = event.group
        self.project.flags.has_releases = True
        self.project.save(update_fields=["flags"])

        assert SlackIssuesMessageBuilder(group).build() == build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
        )

    def test_build_group_block_with_empty_string_message(self):
        event_data = {
            "event_id": "a" * 32,
            "message": "IntegrationError",
            "fingerprint": ["group-1"],
            "exception": {
                "values": [
                    {
                        "type": "IntegrationError",
                        "value": " ",
                    }
                ]
            },
        }
        event = self.store_event(
            data=event_data,
            project_id=self.project.id,
        )
        assert event.group
        group = event.group
        self.project.flags.has_releases = True
        self.project.save(update_fields=["flags"])

        assert SlackIssuesMessageBuilder(group).build() == build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
        )

    @patch(
        "sentry.integrations.slack.message_builder.issues.get_option_groups",
        wraps=get_option_groups,
    )
    def test_build_group_block_prune_duplicate_assignees(self, mock_get_option_groups):
        user2 = self.create_user()
        self.create_member(user=user2, organization=self.organization)
        team2 = self.create_team(organization=self.organization, members=[self.user, user2])
        project2 = self.create_project(organization=self.organization, teams=[self.team, team2])
        group = self.create_group(project=project2)

        SlackIssuesMessageBuilder(group).build()
        assert mock_get_option_groups.called

        team_option_groups, member_option_groups = mock_get_option_groups(group)
        assert len(team_option_groups["options"]) == 2
        assert len(member_option_groups["options"]) == 2

    def test_build_group_attachment_issue_alert(self):
        issue_alert_group = self.create_group(project=self.project)
        ret = SlackIssuesMessageBuilder(issue_alert_group, issue_details=True).build()
        assert isinstance(ret, dict)
        for section in ret["blocks"]:
            assert section["type"] != "actions"

    def test_issue_alert_with_suspect_commits(self):
        self.login_as(user=self.user)
        self.project.flags.has_releases = True
        self.project.save(update_fields=["flags"])
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="example",
            integration_id=self.integration.id,
            url="http://www.github.com/meowmeow/cats",
            provider="integrations:github",
        )
        commit_author = self.create_commit_author(project=self.project, user=self.user)
        self.commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=commit_author,
            key="asdfwreqr",
            message="placeholder commit message",
        )
        pull_request = PullRequest.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="9",
            author=commit_author,
            message="waddap",
            title="cool pr",
            merge_commit_sha=self.commit.key,
        )
        event = self.store_event(
            data={
                "fingerprint": ["group1"],
                "timestamp": before_now(minutes=1).isoformat(),
                "logentry": {"formatted": "bar"},
                "_meta": {"logentry": {"formatted": {"": {"err": ["some error"]}}}},
            },
            project_id=self.project.id,
            assert_no_errors=False,
            default_event_type=EventType.DEFAULT,
        )
        assert event.group
        group = event.group

        GroupOwner.objects.create(
            group=group,
            user_id=self.user.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": self.commit.id},
        )

        suspect_commit_text = f"Suspect Commit: <{self.repo.url}/commit/{self.commit.key}|{self.commit.key[:6]}> by {commit_author.email} {time_since(pull_request.date_added)} \n'{pull_request.title} (#{pull_request.key})' <{pull_request.get_external_url()}|View Pull Request>"

        assert SlackIssuesMessageBuilder(
            group,
            event.for_group(group),
        ).build() == build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
            event=event,
            suspect_commit_text=suspect_commit_text,
            suggested_assignees=commit_author.email,
        )

    def test_issue_alert_with_suspect_commits_unknown_provider(self):
        self.login_as(user=self.user)
        self.project.flags.has_releases = True
        self.project.save(update_fields=["flags"])
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="example",
            integration_id=self.integration.id,
            url="http://www.unknown.com/meowmeow/cats",
            provider="dummy",
        )
        commit_author = self.create_commit_author(project=self.project, user=self.user)
        self.commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=commit_author,
            key="asdfwreqr",
            message="placeholder commit message",
        )
        PullRequest.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="9",
            author=commit_author,
            message="waddap",
            title="cool pr",
            merge_commit_sha=self.commit.key,
        )
        event = self.store_event(
            data={
                "fingerprint": ["group1"],
                "timestamp": before_now(minutes=1).isoformat(),
                "logentry": {"formatted": "bar"},
                "_meta": {"logentry": {"formatted": {"": {"err": ["some error"]}}}},
            },
            project_id=self.project.id,
            assert_no_errors=False,
            default_event_type=EventType.DEFAULT,
        )
        assert event.group
        group = event.group

        GroupOwner.objects.create(
            group=group,
            user_id=self.user.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": self.commit.id},
        )

        suspect_commit_text = f"Suspect Commit: {self.commit.key[:6]} by {commit_author.email}"

        assert SlackIssuesMessageBuilder(
            group,
            event.for_group(group),
        ).build() == build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
            event=event,
            suspect_commit_text=suspect_commit_text,
            suggested_assignees=commit_author.email,
        )

    def test_issue_alert_with_suggested_assignees(self):
        self.project.flags.has_releases = True
        self.project.save(update_fields=["flags"])
        event = self.store_event(
            data={
                "message": "Hello world",
                "level": "error",
                "stacktrace": {"frames": [{"filename": "foo.py"}]},
            },
            project_id=self.project.id,
        )
        assert event.group
        group = event.group

        # create codeowner; user with no slack identity linked
        self.code_mapping = self.create_code_mapping(project=self.project)
        g_rule1 = Rule(Matcher("path", "*"), [Owner("team", self.team.slug)])
        self.create_codeowners(self.project, self.code_mapping, schema=dump_schema([g_rule1]))
        GroupOwner.objects.create(
            group=group,
            type=GroupOwnerType.CODEOWNERS.value,
            user_id=None,
            team_id=self.team.id,
            project=self.project,
            organization=self.organization,
            context={"rule": str(g_rule1)},
        )

        # create ownership rule
        g_rule2 = Rule(Matcher("level", "error"), [Owner("user", self.user.email)])
        GroupOwner.objects.create(
            group=group,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
            user_id=self.user.id,
            team_id=None,
            project=self.project,
            organization=self.organization,
            context={"rule": str(g_rule2)},
        )

        # create suspect commit
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="dogs",
            integration_id=self.integration.id,
            url="http://www.bitbucket.org/woofwoof/dogs",
            provider="bitbucket",
        )
        user2 = self.create_user()
        self.create_member(teams=[self.team], user=user2, organization=self.organization)

        commit = self.create_commit(
            project=self.project,
            repo=repo,
            author=self.create_commit_author(project=self.project, user=user2),
            key="qwertyuiopiuytrewq",
            message="This is a suspect commit!",
        )
        GroupOwner.objects.create(
            group=group,
            user_id=user2.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit.id},
        )

        # auto assign group
        ProjectOwnership.handle_auto_assignment(self.project.id, event)
        suspect_commit_text = f"Suspect Commit: {commit.key[:6]} by {user2.email}"  # no commit link because there is no PR

        expected_blocks = build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
            event=event,
            suggested_assignees=f"#{self.team.slug}, {user2.email}",  # auto-assignee is not included in suggested
            initial_assignee=self.user,
            suspect_commit_text=suspect_commit_text,
        )

        assert (
            SlackIssuesMessageBuilder(group, event.for_group(group), tags={"foo"}).build()
            == expected_blocks
        )

        # suggested user/suspect commit for user with name
        with assume_test_silo_mode(SiloMode.CONTROL):
            user2.update(name="Scooby Doo")
        commit.author.update(name=user2.name)
        suspect_commit_text = f"Suspect Commit: {commit.key[:6]} by {user2.name}"
        expected_blocks = build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
            event=event,
            suggested_assignees=f"#{self.team.slug}, {user2.name}",
            initial_assignee=self.user,
            suspect_commit_text=suspect_commit_text,
        )
        assert (
            SlackIssuesMessageBuilder(group, event.for_group(group), tags={"foo"}).build()
            == expected_blocks
        )

    def test_team_recipient(self):
        issue_alert_group = self.create_group(project=self.project)
        ret = SlackIssuesMessageBuilder(
            issue_alert_group, recipient=Actor.from_object(self.team)
        ).build()
        assert isinstance(ret, dict)
        has_actions = False
        for section in ret["blocks"]:
            if section["type"] == "actions":
                has_actions = True
                break

        assert has_actions

    def test_team_recipient_already_assigned(self):
        issue_alert_group = self.create_group(project=self.project)
        GroupAssignee.objects.create(
            project=self.project, group=issue_alert_group, user_id=self.user.id
        )
        ret = SlackIssuesMessageBuilder(
            issue_alert_group, recipient=Actor.from_object(self.team)
        ).build()
        assert isinstance(ret, dict)
        assert (
            ret["blocks"][2]["elements"][2]["initial_option"]["text"]["text"]
            == self.user.get_display_name()
        )
        assert ret["blocks"][2]["elements"][2]["initial_option"]["value"] == f"user:{self.user.id}"

    def test_build_group_generic_issue_block(self):
        """Test that a generic issue type's Slack alert contains the expected values"""
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])
        occurrence = self.build_occurrence(level="info")
        occurrence.save()
        group_event.occurrence = occurrence

        # uses CATEGORY_TO_EMOJI_V2
        group_event.group.type = ProfileFileIOGroupType.type_id
        blocks = SlackIssuesMessageBuilder(group=group_event.group, event=group_event).build()
        assert isinstance(blocks, dict)
        for section in blocks["blocks"]:
            if section["type"] == "text":
                assert ":large_blue_circle::chart_with_upwards_trend:" in section["text"]["text"]

        # uses LEVEL_TO_EMOJI_V2
        group_event.group.type = ErrorGroupType.type_id
        blocks = SlackIssuesMessageBuilder(group=group_event.group, event=group_event).build()
        assert isinstance(blocks, dict)
        for section in blocks["blocks"]:
            if section["type"] == "text":
                assert ":red_circle:" in section["text"]["text"]

    def test_build_group_generic_issue_block_no_escaping(self):
        """Test that a generic issue type's Slack alert contains the expected values"""
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])
        # should also trim whitespace
        text = "\n\n\n      <bye> ```asdf```      "
        escaped_text = "<bye> `asdf`"

        occurrence = self.build_occurrence(
            level="info",
            evidence_display=[
                {"name": "hi", "value": text, "important": True},
                {"name": "what", "value": "where", "important": False},
            ],
        )
        occurrence.save()
        group_event.occurrence = occurrence

        group_event.group.type = ProfileFileIOGroupType.type_id

        blocks = SlackIssuesMessageBuilder(group=group_event.group, event=group_event).build()

        assert isinstance(blocks, dict)
        for section in blocks["blocks"]:
            if section["type"] == "text":
                assert occurrence.issue_title in section["text"]["text"]

        # no escaping
        assert blocks["blocks"][1]["text"]["text"] == f"```{escaped_text}```"
        assert blocks["text"] == f"[{self.project.slug}] {occurrence.issue_title}"

    def test_build_error_issue_fallback_text(self):
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        blocks = SlackIssuesMessageBuilder(event.group, event.for_group(event.group)).build()
        assert isinstance(blocks, dict)
        assert blocks["text"] == f"[{self.project.slug}] {event.group.title}"

    def test_build_performance_issue(self):
        event = self.create_performance_issue()
        with self.feature("organizations:performance-issues"):
            blocks = SlackIssuesMessageBuilder(event.group, event).build()
        assert isinstance(blocks, dict)
        assert "N+1 Query" in blocks["blocks"][0]["text"]["text"]
        assert (
            "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21"
            in blocks["blocks"][2]["text"]["text"]
        )
        assert blocks["text"] == f"[{self.project.slug}] N+1 Query"

    def test_truncates_long_query(self):
        event = self.store_event(
            data={"message": "a" * 5000, "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])

        occurrence = self.build_occurrence(
            level="info",
            evidence_display=[
                {"name": "hi", "value": "a" * 5000, "important": True},
                {"name": "what", "value": "where", "important": False},
            ],
        )
        occurrence.save()
        group_event.occurrence = occurrence

        group_event.group.type = ProfileFileIOGroupType.type_id

        blocks = SlackIssuesMessageBuilder(group=group_event.group, event=group_event).build()

        assert isinstance(blocks, dict)
        for section in blocks["blocks"]:
            if section["type"] == "text":
                assert occurrence.issue_title in section["text"]["text"]

        truncated_text = "a" * 253 + "..."
        assert blocks["blocks"][1]["text"]["text"] == f"```{truncated_text}```"

        # truncate feedback issues to 1500 chars
        group_event.group.type = FeedbackGroup.type_id

        blocks = SlackIssuesMessageBuilder(group=group_event.group, event=group_event).build()

        truncated_text = "a" * 1497 + "..."
        assert blocks["blocks"][1]["text"]["text"] == f"```{truncated_text}```"

    def test_escape_slack_message(self):
        group = self.create_group(
            project=self.project,
            data={"type": "error", "metadata": {"value": "<https://example.com/|*Click Here*>"}},
        )
        ret = SlackIssuesMessageBuilder(group, None).build()
        assert isinstance(ret, dict)
        assert "<https://example.com/|*Click Here*>" in ret["blocks"][1]["text"]["text"]

    def test_no_description_in_notification(self):
        alert_rule = self.create_alert_rule(description="yeehaw")
        incident = self.create_incident(alert_rule=alert_rule, status=2)
        title = f"Critical: {alert_rule.name}"
        timestamp = "<!date^{:.0f}^Started: {} at {} | Sentry Incident>".format(
            incident.date_started.timestamp(), "{date_pretty}", "{time}"
        )
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": self.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?alert={incident.identifier}&referrer=metric_alert_slack&detection_type={alert_rule.detection_type}"
        )
        assert SlackIncidentsMessageBuilder(incident, IncidentStatus.CRITICAL).build() == {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"0 events in the last 10 minutes\n{timestamp}",
                    },
                },
            ],
            "color": LEVEL_TO_COLOR["fatal"],
            "text": f"<{link}|*{title}*>",
        }


class BuildGroupAttachmentReplaysTest(TestCase):
    @patch("sentry.models.group.Group.has_replays")
    def test_build_replay_issue(self, has_replays):
        replay1_id = "46eb3948be25448abd53fe36b5891ff2"
        self.project.flags.has_replays = True
        self.project.save()

        event = self.store_event(
            data={
                "message": "Hello world",
                "level": "error",
                "contexts": {"replay": {"replay_id": replay1_id}},
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert event.group is not None

        with self.feature(
            ["organizations:session-replay", "organizations:session-replay-slack-new-issue"]
        ):
            blocks = SlackIssuesMessageBuilder(event.group, event.for_group(event.group)).build()
        assert isinstance(blocks, dict)
        assert (
            f"<http://testserver/organizations/baz/issues/{event.group.id}/replays/?referrer=slack|View Replays>"
            in blocks["blocks"][3]["elements"][0]["text"]
        )


class BuildIncidentAttachmentTest(TestCase):
    def test_simple(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=2)
        title = f"Resolved: {alert_rule.name}"
        timestamp = "<!date^{:.0f}^Started: {} at {} | Sentry Incident>".format(
            incident.date_started.timestamp(), "{date_pretty}", "{time}"
        )
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": self.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?alert={incident.identifier}&referrer=metric_alert_slack&detection_type={alert_rule.detection_type}"
        )
        assert SlackIncidentsMessageBuilder(incident, IncidentStatus.CLOSED).build() == {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"0 events in the last 10 minutes\n{timestamp}",
                    },
                }
            ],
            "color": LEVEL_TO_COLOR["_incident_resolved"],
            "text": f"<{link}|*{title}*>",
        }

    def test_metric_value(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=2)

        # This test will use the action/method and not the incident to build status
        title = f"Critical: {alert_rule.name}"
        metric_value = 5000
        timestamp = "<!date^{:.0f}^Started: {} at {} | Sentry Incident>".format(
            incident.date_started.timestamp(), "{date_pretty}", "{time}"
        )
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": self.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?alert={incident.identifier}&referrer=metric_alert_slack&detection_type={alert_rule.detection_type}"
        )
        # This should fail because it pulls status from `action` instead of `incident`
        assert SlackIncidentsMessageBuilder(
            incident, IncidentStatus.CRITICAL, metric_value=metric_value
        ).build() == {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"5000 events in the last 10 minutes\n{timestamp}",
                    },
                }
            ],
            "color": LEVEL_TO_COLOR["fatal"],
            "text": f"<{link}|*{title}*>",
        }

    def test_chart(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=2)
        title = f"Resolved: {alert_rule.name}"
        timestamp = "<!date^{:.0f}^Started: {} at {} | Sentry Incident>".format(
            incident.date_started.timestamp(), "{date_pretty}", "{time}"
        )
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": self.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?alert={incident.identifier}&referrer=metric_alert_slack&detection_type={alert_rule.detection_type}"
        )
        assert SlackIncidentsMessageBuilder(
            incident, IncidentStatus.CLOSED, chart_url="chart-url"
        ).build() == {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"0 events in the last 10 minutes\n{timestamp}",
                    },
                },
                {"alt_text": "Metric Alert Chart", "image_url": "chart-url", "type": "image"},
            ],
            "color": LEVEL_TO_COLOR["_incident_resolved"],
            "text": f"<{link}|*{title}*>",
        }

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_metric_alert_with_anomaly_detection(self, mock_seer_request):
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        alert_rule = self.create_alert_rule(
            detection_type=AlertRuleDetectionType.DYNAMIC,
            time_window=30,
            sensitivity=AlertRuleSensitivity.LOW,
            seasonality=AlertRuleSeasonality.AUTO,
        )
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CRITICAL.value)
        title = f"Critical: {alert_rule.name}"
        timestamp = "<!date^{:.0f}^Started: {} at {} | Sentry Incident>".format(
            incident.date_started.timestamp(), "{date_pretty}", "{time}"
        )
        detection_type = alert_rule.detection_type
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": self.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?alert={incident.identifier}&referrer=metric_alert_slack&detection_type={detection_type}"
        )
        assert SlackIncidentsMessageBuilder(incident, IncidentStatus.CRITICAL).build() == {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"0 events in the last 30 minutes\nThreshold: {detection_type.title()}\n{timestamp}",
                    },
                },
            ],
            "color": LEVEL_TO_COLOR["fatal"],
            "text": f"<{link}|*{title}*>",
        }


class BuildMetricAlertAttachmentTest(TestCase):
    def test_metric_alert_without_incidents(self):
        alert_rule = self.create_alert_rule()
        title = f"Resolved: {alert_rule.name}"
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": self.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?detection_type={alert_rule.detection_type}"
        )
        assert SlackMetricAlertMessageBuilder(alert_rule).build() == {
            "color": LEVEL_TO_COLOR["_incident_resolved"],
            "blocks": [
                {
                    "text": {
                        "text": f"<{link}|*{title}*>  \n",
                        "type": "mrkdwn",
                    },
                    "type": "section",
                },
            ],
        }

    def test_metric_alert_with_selected_incident(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        title = f"Resolved: {alert_rule.name}"
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": self.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?detection_type={alert_rule.detection_type}&alert={incident.identifier}"
        )
        assert SlackMetricAlertMessageBuilder(alert_rule, incident).build() == {
            "color": LEVEL_TO_COLOR["_incident_resolved"],
            "blocks": [
                {
                    "text": {
                        "text": f"<{link}|*{title}*>  \n",
                        "type": "mrkdwn",
                    },
                    "type": "section",
                },
            ],
        }

    def test_metric_alert_with_active_incident(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CRITICAL.value)
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        title = f"Critical: {alert_rule.name}"
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": self.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?detection_type={alert_rule.detection_type}"
        )
        assert SlackMetricAlertMessageBuilder(alert_rule).build() == {
            "color": LEVEL_TO_COLOR["fatal"],
            "blocks": [
                {
                    "text": {
                        "text": f"<{link}|*{title}*>  \n0 events in the last 10 minutes",
                        "type": "mrkdwn",
                    },
                    "type": "section",
                },
            ],
        }

    def test_metric_value(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)

        # This test will use the action/method and not the incident to build status
        title = f"Critical: {alert_rule.name}"
        metric_value = 5000
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": self.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?detection_type={alert_rule.detection_type}&alert={incident.identifier}"
        )
        assert SlackMetricAlertMessageBuilder(
            alert_rule, incident, IncidentStatus.CRITICAL, metric_value=metric_value
        ).build() == {
            "color": LEVEL_TO_COLOR["fatal"],
            "blocks": [
                {
                    "text": {
                        "text": f"<{link}|*{title}*>  \n"
                        f"{metric_value} events in the last 10 minutes",
                        "type": "mrkdwn",
                    },
                    "type": "section",
                },
            ],
        }

    def test_metric_alert_chart(self):
        alert_rule = self.create_alert_rule()
        title = f"Resolved: {alert_rule.name}"
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": self.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?detection_type={alert_rule.detection_type}"
        )
        assert SlackMetricAlertMessageBuilder(alert_rule, chart_url="chart_url").build() == {
            "color": LEVEL_TO_COLOR["_incident_resolved"],
            "blocks": [
                {
                    "text": {
                        "text": f"<{link}|*{title}*>  \n",
                        "type": "mrkdwn",
                    },
                    "type": "section",
                },
                {"alt_text": "Metric Alert Chart", "image_url": "chart_url", "type": "image"},
            ],
        }

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_metric_alert_with_anomaly_detection(self, mock_seer_request):
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        alert_rule = self.create_alert_rule(
            detection_type=AlertRuleDetectionType.DYNAMIC,
            time_window=30,
            sensitivity=AlertRuleSensitivity.LOW,
            seasonality=AlertRuleSeasonality.AUTO,
        )
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CRITICAL.value)
        trigger = self.create_alert_rule_trigger(alert_rule=alert_rule, alert_threshold=0)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        title = f"Critical: {alert_rule.name}"
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": self.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?detection_type={alert_rule.detection_type}"
        )
        assert SlackMetricAlertMessageBuilder(alert_rule).build() == {
            "color": LEVEL_TO_COLOR["fatal"],
            "blocks": [
                {
                    "text": {
                        "text": f"<{link}|*{title}*>  \n0 events in the last 30 minutes\nThreshold: {alert_rule.detection_type.title()}",
                        "type": "mrkdwn",
                    },
                    "type": "section",
                },
            ],
        }


class ActionsTest(TestCase):
    def test_identity_and_action(self):
        # returns True to indicate to use the white circle emoji
        group = self.create_group(project=self.project)
        MOCKIDENTITY = Mock()

        assert build_actions(
            group, self.project, "test txt", [MessageAction(name="TEST")], MOCKIDENTITY
        ) == ([], "", True)

    def _assert_message_actions_list(self, actions, expected):
        actions_dict = [
            {"name": a.name, "label": a.label, "type": a.type, "value": a.value} for a in actions
        ]
        assert expected in actions_dict

    def test_ignore_has_escalating(self):
        group = self.create_group(project=self.project)
        group.status = GroupStatus.IGNORED
        group.save()

        expected = {
            "label": "Mark as Ongoing",
            "name": "status",
            "type": "button",
            "value": "unresolved:ongoing",
        }

        res = build_actions(group, self.project, "test txt", [MessageAction(name="TEST")], None)
        self._assert_message_actions_list(
            res[0],
            expected,
        )

    def test_ignore_does_not_have_escalating(self):
        group = self.create_group(project=self.project)
        group.status = GroupStatus.IGNORED
        group.save()

        expected = {
            "label": "Mark as Ongoing",
            "name": "status",
            "type": "button",
            "value": "unresolved:ongoing",
        }
        res = build_actions(group, self.project, "test txt", [MessageAction(name="TEST")], None)
        self._assert_message_actions_list(
            res[0],
            expected,
        )

    def test_ignore_unresolved_no_escalating(self):
        group = self.create_group(project=self.project)
        group.status = GroupStatus.UNRESOLVED
        group.save()

        expected = {
            "label": "Archive",
            "name": "status",
            "type": "button",
            "value": "archive_dialog",
        }
        res = build_actions(group, self.project, "test txt", [MessageAction(name="TEST")], None)
        self._assert_message_actions_list(
            res[0],
            expected,
        )

    def test_ignore_unresolved_has_escalating(self):
        group = self.create_group(project=self.project)
        group.status = GroupStatus.UNRESOLVED
        group.save()

        expected = {
            "label": "Archive",
            "name": "status",
            "type": "button",
            "value": "archive_dialog",
        }
        res = build_actions(group, self.project, "test txt", [MessageAction(name="TEST")], None)
        self._assert_message_actions_list(
            res[0],
            expected,
        )

    def test_no_ignore_if_feedback(self):
        group = self.create_group(project=self.project, type=FeedbackGroup.type_id)
        res = build_actions(group, self.project, "test txt", [MessageAction(name="TEST")], None)
        # no ignore action if feedback issue, so only assign and resolve
        assert len(res[0]) == 2

    def test_resolve_resolved(self):
        group = self.create_group(project=self.project)
        group.status = GroupStatus.RESOLVED
        group.save()

        res = build_actions(group, self.project, "test txt", [MessageAction(name="TEST")], None)

        self._assert_message_actions_list(
            res[0],
            {
                "label": "Unresolve",
                "name": "unresolved:ongoing",
                "type": "button",
                "value": "unresolved:ongoing",
            },
        )

    def test_resolve_unresolved_no_releases(self):
        group = self.create_group(project=self.project)
        group.status = GroupStatus.UNRESOLVED
        group.save()
        self.project.flags.has_releases = False
        self.project.save()

        res = build_actions(group, self.project, "test txt", [MessageAction(name="TEST")], None)
        self._assert_message_actions_list(
            res[0],
            {
                "label": "Resolve",
                "name": "status",
                "type": "button",
                "value": "resolved",
            },
        )

    def test_resolve_unresolved_has_releases(self):
        group = self.create_group(project=self.project)
        group.status = GroupStatus.UNRESOLVED
        group.save()
        self.project.flags.has_releases = True
        self.project.save()

        res = build_actions(group, self.project, "test txt", [MessageAction(name="TEST")], None)
        self._assert_message_actions_list(
            res[0],
            {
                "label": "Resolve",
                "name": "status",
                "type": "button",
                "value": "resolve_dialog",
            },
        )

    def test_assign(self):
        group = self.create_group(project=self.project)
        group.status = GroupStatus.UNRESOLVED
        group.save()
        self.project.flags.has_releases = True
        self.project.save()

        res = build_actions(group, self.project, "test txt", [MessageAction(name="TEST")], None)

        self._assert_message_actions_list(
            res[0],
            {"label": "Select Assignee...", "name": "assign", "type": "select", "value": None},
        )


class SlackNotificationConfigTest(TestCase, PerformanceIssueTestCase, OccurrenceTestMixin):
    @freeze_time("2024-02-23")
    def setUp(self):
        self.endpoint_regression_issue = self.create_group(
            type=PerformanceP95EndpointRegressionGroupType.type_id
        )

        self.cron_issue = self.create_group(type=MonitorIncidentType.type_id)
        self.feedback_issue = self.create_group(
            type=FeedbackGroup.type_id, substatus=GroupSubStatus.NEW
        )

    @freeze_time("2024-02-23")
    @patch("sentry.models.Group.get_recommended_event_for_environments")
    def test_get_context(self, mock_event):
        event = self.store_event(data={"message": "Hello world"}, project_id=self.project.id)
        group_event = event.for_group(event.groups[0])
        occurrence = self.build_occurrence(level="info", evidence_data={"breakpoint": 1709161200})
        occurrence.save()
        group_event.occurrence = occurrence

        mock_event.return_value = group_event

        # endpoint regression should use Approx Start Time
        context = get_context(self.endpoint_regression_issue)
        breakpoint_time = datetime(2024, 2, 28, 23, 0)
        assert f"Approx. Start Time: *{breakpoint_time.strftime('%Y-%m-%d %H:%M:%S')}*" in context

        # crons don't have context
        assert get_context(self.cron_issue) == ""

        # feedback doesn't have context
        assert get_context(self.feedback_issue) == ""

    def test_get_context_error_user_count(self):
        event = self.store_event(
            data={},
            project_id=self.project.id,
            assert_no_errors=False,
        )
        group = event.group
        assert group

        context_without_error_user_count = get_context(group)
        assert (
            context_without_error_user_count
            == f"State: *New*   First Seen: *{time_since(group.first_seen)}*"
        )

        group.times_seen = 3
        group.substatus = GroupSubStatus.ONGOING
        group.save()

        context_with_error_user_count = get_context(group)
        assert (
            context_with_error_user_count
            == f"Events: *3*   State: *Ongoing*   First Seen: *{time_since(group.first_seen)}*"
        )

    def test_get_context_users_affected(self):
        env = self.create_environment(project=self.project)
        env2 = self.create_environment(project=self.project)
        rule = IssueAlertRule.objects.create(project=self.project, label="my rule")

        event = [
            self.store_event(
                data={
                    "user": {"id": i},
                    "environment": env.name,
                },
                project_id=self.project.id,
                assert_no_errors=False,
            )
            for i in range(5)
        ][0]
        [
            self.store_event(
                data={
                    "user": {"id": i},
                    "environment": env2.name,
                },
                project_id=self.project.id,
                assert_no_errors=False,
            )
            for i in range(5, 7)
        ]

        group = event.group
        assert group
        group.update(type=1, substatus=GroupSubStatus.ONGOING, times_seen=3)

        context = get_context(group, [rule])
        assert (
            context
            == f"Events: *3*   Users Affected: *7*   State: *Ongoing*   First Seen: *{time_since(group.first_seen)}*"
        )

        # filter users affected by env
        rule.update(environment_id=env.id)
        context = get_context(group, [rule])
        assert (
            context
            == f"Events: *3*   Users Affected: *5*   State: *Ongoing*   First Seen: *{time_since(group.first_seen)}*"
        )

    def test_get_tags(self):
        # don't use default tags. if we don't pass in tags to get_tags, we don't return any
        tags = get_tags(
            self.endpoint_regression_issue, self.endpoint_regression_issue.get_latest_event()
        )
        assert not tags
