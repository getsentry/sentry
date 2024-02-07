from __future__ import annotations

import copy
from datetime import datetime
from typing import Any
from unittest.mock import Mock, patch

from django.urls import reverse

from sentry.eventstore.models import Event
from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.incidents.models import IncidentStatus
from sentry.integrations.slack.message_builder import LEVEL_TO_COLOR
from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder
from sentry.integrations.slack.message_builder.issues import (
    SlackIssuesMessageBuilder,
    build_actions,
    format_release_tag,
    get_option_groups,
    get_option_groups_block_kit,
    time_since,
)
from sentry.integrations.slack.message_builder.metric_alerts import SlackMetricAlertMessageBuilder
from sentry.issues.grouptype import (
    FeedbackGroup,
    PerformanceNPlusOneGroupType,
    ProfileFileIOGroupType,
)
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.projectownership import ProjectOwnership
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.models.team import Team
from sentry.models.user import User
from sentry.notifications.utils import get_commits
from sentry.notifications.utils.actions import MessageAction
from sentry.ownership.grammar import Matcher, Owner, Rule, dump_schema
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.silo.base import SiloMode
from sentry.testutils.cases import PerformanceIssueTestCase, TestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils.dates import to_timestamp
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

    title = group.title
    title_link = f"http://testserver/organizations/{project.organization.slug}/issues/{group.id}"
    formatted_title = title
    if event:
        title = event.title
        if title == "<unlabeled event>":
            formatted_title = "&lt;unlabeled event&gt;"
        if link_to_event:
            title_link += f"/events/{event.event_id}"
    title_link += "/?referrer=slack"
    title_text = f":exclamation: <{title_link}|*{formatted_title}*>"

    blocks: list[dict[str, Any]] = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": title_text},
            "block_id": f'{{"issue":{group.id}}}',
        },
    ]

    tags_text = ""
    if not tags:
        tags = {"level": "error"}
    for k, v in tags.items():
        if k == "release":
            v = format_release_tag(v, group)
        tags_text += f"{k}: `{v}`  "

    tags_section = {"type": "section", "text": {"type": "mrkdwn", "text": tags_text}}
    blocks.append(tags_section)

    # add event and user count, state, first seen
    counts_section = {
        "type": "context",
        "elements": [
            {
                "type": "mrkdwn",
                "text": f"Events: *1*   State: *Ongoing*   First Seen: *{time_since(group.first_seen)}*",
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

    return {
        "blocks": blocks,
        "text": f"[{project.slug}] {title}",
    }


def build_test_message(
    teams: set[Team],
    users: set[User],
    timestamp: datetime,
    group: Group,
    event: Event | None = None,
    link_to_event: bool = False,
) -> dict[str, Any]:
    project = group.project

    title = group.title
    title_link = f"http://testserver/organizations/{project.organization.slug}/issues/{group.id}"
    if event:
        title = event.title
        if link_to_event:
            title_link += f"/events/{event.event_id}"
    title_link += "/?referrer=slack"

    return {
        "text": "",
        "color": "#E03E2F",  # red for error level
        "actions": [
            {"name": "status", "text": "Resolve", "type": "button", "value": "resolved"},
            {
                "name": "status",
                "text": "Archive",
                "type": "button",
                "value": "ignored:until_escalating",
            },
            {
                "option_groups": [
                    {
                        "text": "Teams",
                        "options": [
                            {"text": f"#{team.slug}", "value": f"team:{team.id}"} for team in teams
                        ],
                    },
                    {
                        "text": "People",
                        "options": [
                            {
                                "text": user.email,
                                "value": f"user:{user.id}",
                            }
                            for user in users
                        ],
                    },
                ],
                "text": "Select Assignee...",
                "selected_options": [],
                "type": "select",
                "name": "assign",
            },
        ],
        "mrkdwn_in": ["text"],
        "title": title,
        "fields": [],
        "footer": f"{project.slug.upper()}-1",
        "ts": to_timestamp(timestamp),
        "title_link": title_link,
        "callback_id": '{"issue":' + str(group.id) + "}",
        "fallback": f"[{project.slug}] {title}",
        "footer_icon": "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png",
    }


@region_silo_test
class BuildGroupAttachmentTest(TestCase, PerformanceIssueTestCase, OccurrenceTestMixin):
    def test_build_group_attachment(self):
        group = self.create_group(project=self.project)
        assert SlackIssuesMessageBuilder(group).build() == build_test_message(
            teams={self.team},
            users={self.user},
            timestamp=group.last_seen,
            group=group,
        )

        event = self.store_event(data={}, project_id=self.project.id)

        assert SlackIssuesMessageBuilder(
            group, event.for_group(group)
        ).build() == build_test_message(
            teams={self.team},
            users={self.user},
            timestamp=event.datetime,
            group=group,
            event=event,
        )

        assert SlackIssuesMessageBuilder(
            group, event.for_group(group), link_to_event=True
        ).build() == build_test_message(
            teams={self.team},
            users={self.user},
            timestamp=event.datetime,
            group=group,
            event=event,
            link_to_event=True,
        )

        test_message = build_test_message(
            teams={self.team},
            users={self.user},
            timestamp=group.last_seen,
            group=group,
        )
        test_message["actions"] = [
            action
            if action["text"] != "Ignore"
            else {
                "name": "status",
                "text": "Archive",
                "type": "button",
                "value": "ignored:until_escalating",
            }
            for action in test_message["actions"]
        ]
        assert SlackIssuesMessageBuilder(group).build() == test_message

    @with_feature("organizations:slack-block-kit")
    def test_build_group_block(self):

        release = self.create_release(project=self.project)
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "tags": {"foo": "bar"},
                "timestamp": iso_format(before_now(minutes=1)),
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
        base_tags = {"level": "error", "release": release.version}
        more_tags = {"foo": "bar", **base_tags}
        notes = "hey @colleen fix it"

        assert SlackIssuesMessageBuilder(group).build() == build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
            tags=base_tags,
        )
        # add extra tag to message
        assert SlackIssuesMessageBuilder(
            group, event.for_group(group), tags={"foo"}
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
            tags=base_tags,
        )
        # add extra tag and notes to message
        assert SlackIssuesMessageBuilder(
            group, event.for_group(group), tags={"foo"}, notes=notes
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
            tags=base_tags,
        )

        assert SlackIssuesMessageBuilder(
            group, event.for_group(group), link_to_event=True
        ).build() == build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
            event=event,
            link_to_event=True,
            tags=base_tags,
        )

        test_message = build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
            tags=base_tags,
        )

        assert SlackIssuesMessageBuilder(group).build() == test_message

    @patch(
        "sentry.integrations.slack.message_builder.issues.get_option_groups",
        wraps=get_option_groups,
    )
    def test_build_group_attachment_prune_duplicate_assignees(self, mock_get_option_groups):
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

    @with_feature("organizations:slack-block-kit")
    @patch(
        "sentry.integrations.slack.message_builder.issues.get_option_groups_block_kit",
        wraps=get_option_groups_block_kit,
    )
    def test_build_group_block_prune_duplicate_assignees(self, mock_get_option_groups_block_kit):
        user2 = self.create_user()
        self.create_member(user=user2, organization=self.organization)
        team2 = self.create_team(organization=self.organization, members=[self.user, user2])
        project2 = self.create_project(organization=self.organization, teams=[self.team, team2])
        group = self.create_group(project=project2)

        SlackIssuesMessageBuilder(group).build()
        assert mock_get_option_groups_block_kit.called

        team_option_groups, member_option_groups = mock_get_option_groups_block_kit(group)
        assert len(team_option_groups["options"]) == 2
        assert len(member_option_groups["options"]) == 2

    def test_build_group_attachment_issue_alert(self):
        issue_alert_group = self.create_group(project=self.project)
        ret = SlackIssuesMessageBuilder(issue_alert_group, issue_details=True).build()
        assert isinstance(ret, dict)
        assert ret["actions"] == []

    @with_feature("organizations:slack-block-kit")
    def test_build_group_attachment_issue_alert_block_kit(self):
        issue_alert_group = self.create_group(project=self.project)
        ret = SlackIssuesMessageBuilder(issue_alert_group, issue_details=True).build()
        assert isinstance(ret, dict)
        for section in ret["blocks"]:
            assert section["type"] != "actions"

    @patch(
        "sentry.api.serializers.models.pullrequest.PullRequestSerializer._external_url",
        return_value="https://github.com/meowmeow/cats/pull/1",
    )
    @with_feature("organizations:slack-block-kit")
    def test_issue_alert_with_suspect_commits(self, mock_external_url):
        self.login_as(user=self.user)
        self.project.flags.has_releases = True
        self.project.save(update_fields=["flags"])
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="example",
            integration_id=self.integration.id,
            url="http://www.github.com/meowmeow/cats",
            provider="github",
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
                "timestamp": iso_format(before_now(minutes=1)),
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "logentry": {"formatted": "bar"},
                "_meta": {"logentry": {"formatted": {"": {"err": ["some error"]}}}},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        assert event.group
        group = event.group

        GroupOwner.objects.create(
            group=event.group,
            user_id=self.user.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": self.commit.id},
        )

        suspect_commit_text = f"Suspect Commit: <{self.repo.url}/commit/{self.commit.key}|{self.commit.key[:6]}> by {commit_author.email} {time_since(pull_request.date_added)} \n'{pull_request.title} (#{pull_request.key})' <{mock_external_url.return_value}|View Pull Request>"
        commits = get_commits(self.project, event)

        assert SlackIssuesMessageBuilder(
            group,
            event.for_group(group),
            commits=commits,
        ).build() == build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
            event=event,
            suspect_commit_text=suspect_commit_text,
        )

    @patch(
        "sentry.api.serializers.models.pullrequest.PullRequestSerializer._external_url",
        return_value="https://unknown.com/meowmeow/cats/pull/1",
    )
    @with_feature("organizations:slack-block-kit")
    def test_issue_alert_with_suspect_commits_unknown_provider(self, mock_external_url):
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
                "timestamp": iso_format(before_now(minutes=1)),
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "logentry": {"formatted": "bar"},
                "_meta": {"logentry": {"formatted": {"": {"err": ["some error"]}}}},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        assert event.group
        group = event.group

        GroupOwner.objects.create(
            group=event.group,
            user_id=self.user.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": self.commit.id},
        )

        suspect_commit_text = f"Suspect Commit: {self.commit.key[:6]} by {commit_author.email} {time_since(pull_request.date_added)} \n'{pull_request.title} (#{pull_request.key})' <{mock_external_url.return_value}|View Pull Request>"
        commits = get_commits(self.project, event)

        assert SlackIssuesMessageBuilder(
            group,
            event.for_group(group),
            commits=commits,
        ).build() == build_test_message_blocks(
            teams={self.team},
            users={self.user},
            group=group,
            event=event,
            suspect_commit_text=suspect_commit_text,
        )

    @with_feature("organizations:slack-block-kit")
    @with_feature("organizations:streamline-targeting-context")
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

        commits = get_commits(self.project, event)
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
            SlackIssuesMessageBuilder(
                group, event.for_group(group), tags={"foo"}, commits=commits
            ).build()
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
        commits = get_commits(self.project, event)
        assert (
            SlackIssuesMessageBuilder(
                group, event.for_group(group), tags={"foo"}, commits=commits
            ).build()
            == expected_blocks
        )

    def test_team_recipient(self):
        issue_alert_group = self.create_group(project=self.project)
        ret = SlackIssuesMessageBuilder(
            issue_alert_group, recipient=RpcActor.from_object(self.team)
        ).build()
        assert isinstance(ret, dict)
        assert ret["actions"] != []

    @with_feature("organizations:slack-block-kit")
    def test_team_recipient_block_kit(self):
        issue_alert_group = self.create_group(project=self.project)
        ret = SlackIssuesMessageBuilder(
            issue_alert_group, recipient=RpcActor.from_object(self.team)
        ).build()
        assert isinstance(ret, dict)
        has_actions = False
        for section in ret["blocks"]:
            if section["type"] == "actions":
                has_actions = True
                break

        assert has_actions

    @with_feature("organizations:slack-block-kit")
    def test_team_recipient_block_kit_already_assigned(self):
        issue_alert_group = self.create_group(project=self.project)
        GroupAssignee.objects.create(
            project=self.project, group=issue_alert_group, user_id=self.user.id
        )
        ret = SlackIssuesMessageBuilder(
            issue_alert_group, recipient=RpcActor.from_object(self.team)
        ).build()
        assert isinstance(ret, dict)
        assert (
            ret["blocks"][2]["elements"][2]["initial_option"]["text"]["text"]
            == self.user.get_display_name()
        )
        assert ret["blocks"][2]["elements"][2]["initial_option"]["value"] == f"user:{self.user.id}"

    # XXX(CEO): skipping replicating tests relating to color since there is no block kit equivalent
    def test_build_group_attachment_color_no_event_error_fallback(self):
        group_with_no_events = self.create_group(project=self.project)
        ret = SlackIssuesMessageBuilder(group_with_no_events).build()
        assert isinstance(ret, dict)
        assert ret["color"] == "#E03E2F"

    def test_build_group_attachment_color_unexpected_level_error_fallback(self):
        unexpected_level_event = self.store_event(
            data={"level": "trace"}, project_id=self.project.id, assert_no_errors=False
        )
        assert unexpected_level_event.group is not None
        ret = SlackIssuesMessageBuilder(unexpected_level_event.group).build()
        assert isinstance(ret, dict)
        assert ret["color"] == "#E03E2F"

    def test_build_group_attachment_color_warning(self):
        warning_event = self.store_event(data={"level": "warning"}, project_id=self.project.id)
        assert warning_event.group is not None
        ret1 = SlackIssuesMessageBuilder(warning_event.group).build()
        assert isinstance(ret1, dict)
        assert ret1["color"] == "#FFC227"
        ret2 = SlackIssuesMessageBuilder(
            warning_event.group, warning_event.for_group(warning_event.group)
        ).build()
        assert isinstance(ret2, dict)
        assert ret2["color"] == "#FFC227"

    def test_build_group_generic_issue_attachment(self):
        """Test that a generic issue type's Slack alert contains the expected values"""
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])
        occurrence = self.build_occurrence(level="info")
        occurrence.save()
        group_event.occurrence = occurrence

        group_event.group.type = ProfileFileIOGroupType.type_id

        attachments = SlackIssuesMessageBuilder(group=group_event.group, event=group_event).build()

        assert isinstance(attachments, dict)
        assert attachments["title"] == occurrence.issue_title
        assert attachments["text"] == occurrence.evidence_display[0].value
        assert attachments["fallback"] == f"[{self.project.slug}] {occurrence.issue_title}"
        assert attachments["color"] == "#2788CE"  # blue for info level

    @with_feature("organizations:slack-block-kit")
    def test_build_group_generic_issue_block(self):
        """Test that a generic issue type's Slack alert contains the expected values"""
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])
        occurrence = self.build_occurrence(level="info")
        occurrence.save()
        group_event.occurrence = occurrence

        group_event.group.type = ProfileFileIOGroupType.type_id

        blocks = SlackIssuesMessageBuilder(group=group_event.group, event=group_event).build()
        assert isinstance(blocks, dict)
        for section in blocks["blocks"]:
            if section["type"] == "text":
                assert occurrence.issue_title in section["text"]["text"]

        assert (
            occurrence.evidence_display[0].value
            in blocks["blocks"][1]["elements"][0]["elements"][0]["text"]
        )
        assert blocks["text"] == f"[{self.project.slug}] {occurrence.issue_title}"

    def test_build_error_issue_fallback_text(self):
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        attachments = SlackIssuesMessageBuilder(event.group, event.for_group(event.group)).build()
        assert isinstance(attachments, dict)
        assert attachments["fallback"] == f"[{self.project.slug}] {event.group.title}"

    @with_feature("organizations:slack-block-kit")
    def test_build_error_issue_fallback_text_block_kit(self):
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        blocks = SlackIssuesMessageBuilder(event.group, event.for_group(event.group)).build()
        assert isinstance(blocks, dict)
        assert blocks["text"] == f"[{self.project.slug}] {event.group.title}"

    def test_build_performance_issue(self):
        event = self.create_performance_issue()
        with self.feature("organizations:performance-issues"):
            attachments = SlackIssuesMessageBuilder(event.group, event).build()
        assert isinstance(attachments, dict)
        assert attachments["title"] == "N+1 Query"
        assert (
            attachments["text"]
            == "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21"
        )
        assert attachments["fallback"] == f"[{self.project.slug}] N+1 Query"
        assert attachments["color"] == "#2788CE"  # blue for info level

    @with_feature("organizations:slack-block-kit")
    def test_build_performance_issue_block_kit(self):
        event = self.create_performance_issue()
        with self.feature("organizations:performance-issues"):
            blocks = SlackIssuesMessageBuilder(event.group, event).build()
        assert isinstance(blocks, dict)
        assert "N+1 Query" in blocks["blocks"][0]["text"]["text"]
        assert (
            "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21"
            in blocks["blocks"][1]["elements"][0]["elements"][0]["text"]
        )
        assert blocks["text"] == f"[{self.project.slug}] N+1 Query"

    def test_build_performance_issue_color_no_event_passed(self):
        """This test doesn't pass an event to the SlackIssuesMessageBuilder to mimic what
        could happen in that case (it is optional). It also creates a performance group that won't
        have a latest event attached to it to mimic a specific edge case.
        """
        perf_group = self.create_group(type=PerformanceNPlusOneGroupType.type_id)
        attachments = SlackIssuesMessageBuilder(perf_group).build()

        assert isinstance(attachments, dict)
        assert attachments["color"] == "#2788CE"  # blue for info level

    def test_escape_slack_message(self):
        group = self.create_group(
            project=self.project,
            data={"type": "error", "metadata": {"value": "<https://example.com/|*Click Here*>"}},
        )
        ret = SlackIssuesMessageBuilder(group, None).build()
        assert isinstance(ret, dict)
        assert ret["text"] == "&lt;https://example.com/|*Click Here*&gt;"

    @with_feature("organizations:slack-block-kit")
    def test_escape_slack_message_block_kit(self):
        group = self.create_group(
            project=self.project,
            data={"type": "error", "metadata": {"value": "<https://example.com/|*Click Here*>"}},
        )
        ret = SlackIssuesMessageBuilder(group, None).build()
        assert isinstance(ret, dict)
        assert (
            "&lt;https://example.com/|*Click Here*&gt;"
            in ret["blocks"][1]["elements"][0]["elements"][0]["text"]
        )


@region_silo_test
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
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )
        assert event.group is not None

        with self.feature(
            ["organizations:session-replay", "organizations:session-replay-slack-new-issue"]
        ):
            attachments = SlackIssuesMessageBuilder(
                event.group, event.for_group(event.group)
            ).build()
        assert isinstance(attachments, dict)
        assert (
            attachments["text"]
            == f"\n\n<http://testserver/organizations/baz/issues/{event.group.id}/replays/?referrer=slack|View Replays>"
        )

    @with_feature("organizations:slack-block-kit")
    @patch("sentry.models.group.Group.has_replays")
    def test_build_replay_issue_block_kit(self, has_replays):
        replay1_id = "46eb3948be25448abd53fe36b5891ff2"
        self.project.flags.has_replays = True
        self.project.save()

        event = self.store_event(
            data={
                "message": "Hello world",
                "level": "error",
                "contexts": {"replay": {"replay_id": replay1_id}},
                "timestamp": iso_format(before_now(minutes=1)),
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
            in blocks["blocks"][4]["elements"][0]["text"]
        )


@region_silo_test
class BuildIncidentAttachmentTest(TestCase):
    def test_simple(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=2)
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        title = f"Resolved: {alert_rule.name}"
        timestamp = "<!date^{:.0f}^Started {} at {} | Sentry Incident>".format(
            to_timestamp(incident.date_started), "{date_pretty}", "{time}"
        )
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": alert_rule.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?alert={incident.identifier}&referrer=metric_alert_slack"
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
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        timestamp = "<!date^{:.0f}^Started {} at {} | Sentry Incident>".format(
            to_timestamp(incident.date_started), "{date_pretty}", "{time}"
        )
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": alert_rule.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?alert={incident.identifier}&referrer=metric_alert_slack"
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
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        title = f"Resolved: {alert_rule.name}"
        timestamp = "<!date^{:.0f}^Started {} at {} | Sentry Incident>".format(
            to_timestamp(incident.date_started), "{date_pretty}", "{time}"
        )
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": alert_rule.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?alert={incident.identifier}&referrer=metric_alert_slack"
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


@region_silo_test
class BuildMetricAlertAttachmentTest(TestCase):
    def test_metric_alert_without_incidents(self):
        alert_rule = self.create_alert_rule()
        title = f"Resolved: {alert_rule.name}"
        link = absolute_uri(
            reverse(
                "sentry-metric-alert-details",
                kwargs={
                    "organization_slug": alert_rule.organization.slug,
                    "alert_rule_id": alert_rule.id,
                },
            )
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
                        "organization_slug": alert_rule.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?alert={incident.identifier}"
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
        link = absolute_uri(
            reverse(
                "sentry-metric-alert-details",
                kwargs={
                    "organization_slug": alert_rule.organization.slug,
                    "alert_rule_id": alert_rule.id,
                },
            )
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
        link = absolute_uri(
            reverse(
                "sentry-metric-alert-details",
                kwargs={
                    "organization_slug": alert_rule.organization.slug,
                    "alert_rule_id": alert_rule.id,
                },
            )
        )
        assert SlackMetricAlertMessageBuilder(
            alert_rule, incident, IncidentStatus.CRITICAL, metric_value=metric_value
        ).build() == {
            "color": LEVEL_TO_COLOR["fatal"],
            "blocks": [
                {
                    "text": {
                        "text": f"<{link}?alert={incident.identifier}|*{title}*>  \n"
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
        link = absolute_uri(
            reverse(
                "sentry-metric-alert-details",
                kwargs={
                    "organization_slug": alert_rule.organization.slug,
                    "alert_rule_id": alert_rule.id,
                },
            )
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


@region_silo_test
class ActionsTest(TestCase):
    def test_identity_and_action(self):
        group = self.create_group(project=self.project)
        MOCKIDENTITY = Mock()
        assert build_actions(
            group, self.project, "test txt", "red", [MessageAction(name="TEST")], MOCKIDENTITY
        ) == ([], "", "_actioned_issue")

        with self.feature("organizations:slack-block-kit"):
            assert build_actions(
                group, self.project, "test txt", "red", [MessageAction(name="TEST")], MOCKIDENTITY
            ) == ([], "", "_actioned_issue")

    def _assert_message_actions_list(self, actions, expected):
        actions_dict = [
            {"name": a.name, "label": a.label, "type": a.type, "value": a.value} for a in actions
        ]
        assert expected in actions_dict

    def test_ignore_has_escalating(self):
        group = self.create_group(project=self.project)
        group.status = GroupStatus.IGNORED
        group.save()

        res = build_actions(
            group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
        )
        expected = {
            "label": "Mark as Ongoing",
            "name": "status",
            "type": "button",
            "value": "unresolved:ongoing",
        }
        self._assert_message_actions_list(
            res[0],
            expected,
        )

        with self.feature("organizations:slack-block-kit"):
            res = build_actions(
                group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
            )
        self._assert_message_actions_list(
            res[0],
            expected,
        )

    def test_ignore_does_not_have_escalating(self):
        group = self.create_group(project=self.project)
        group.status = GroupStatus.IGNORED
        group.save()

        res = build_actions(
            group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
        )

        expected = {
            "label": "Mark as Ongoing",
            "name": "status",
            "type": "button",
            "value": "unresolved:ongoing",
        }
        self._assert_message_actions_list(
            res[0],
            expected,
        )
        with self.feature("organizations:slack-block-kit"):
            res = build_actions(
                group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
            )
            self._assert_message_actions_list(
                res[0],
                expected,
            )

    def test_ignore_unresolved_no_escalating(self):
        group = self.create_group(project=self.project)
        group.status = GroupStatus.UNRESOLVED
        group.save()

        res = build_actions(
            group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
        )
        expected = {
            "label": "Archive",
            "name": "status",
            "type": "button",
            "value": "ignored:until_escalating",
        }
        self._assert_message_actions_list(
            res[0],
            expected,
        )

        with self.feature("organizations:slack-block-kit"):
            res = build_actions(
                group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
            )
            expected.update({"name": "status", "value": "archive_dialog"})
            self._assert_message_actions_list(
                res[0],
                expected,
            )

    def test_ignore_unresolved_has_escalating(self):
        group = self.create_group(project=self.project)
        group.status = GroupStatus.UNRESOLVED
        group.save()

        res = build_actions(
            group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
        )
        expected = {
            "label": "Archive",
            "name": "status",
            "type": "button",
            "value": "ignored:until_escalating",
        }
        self._assert_message_actions_list(
            res[0],
            expected,
        )
        with self.feature("organizations:slack-block-kit"):
            res = build_actions(
                group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
            )
            expected.update({"name": "status", "value": "archive_dialog"})
            self._assert_message_actions_list(
                res[0],
                expected,
            )

    def test_no_ignore_if_feedback(self):
        group = self.create_group(project=self.project, type=FeedbackGroup.type_id)
        res = build_actions(
            group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
        )
        # no ignore action if feedback issue, so only assign and resolve
        assert len(res[0]) == 2

        with self.feature("organizations:slack-block-kit"):
            res = build_actions(
                group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
            )
            # no ignore action if feedback issue, so only assign and resolve
            assert len(res[0]) == 2

    def test_resolve_resolved(self):
        group = self.create_group(project=self.project)
        group.status = GroupStatus.RESOLVED
        group.save()

        res = build_actions(
            group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
        )
        expected = {
            "label": "Unresolve",
            "name": "status",
            "type": "button",
            "value": "unresolved:ongoing",
        }
        self._assert_message_actions_list(
            res[0],
            expected,
        )
        with self.feature("organizations:slack-block-kit"):
            res = build_actions(
                group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
            )

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

        res = build_actions(
            group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
        )

        self._assert_message_actions_list(
            res[0],
            {
                "label": "Resolve",
                "name": "status",
                "type": "button",
                "value": "resolved",
            },
        )
        with self.feature("organizations:slack-block-kit"):
            res = build_actions(
                group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
            )
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

        res = build_actions(
            group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
        )

        self._assert_message_actions_list(
            res[0],
            {
                "label": "Resolve...",
                "name": "resolve_dialog",
                "type": "button",
                "value": "resolve_dialog",
            },
        )

        with self.feature("organizations:slack-block-kit"):
            res = build_actions(
                group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
            )
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

        res = build_actions(
            group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
        )

        self._assert_message_actions_list(
            res[0],
            {"label": "Select Assignee...", "name": "assign", "type": "select", "value": None},
        )
        with self.feature("organizations:slack-block-kit"):
            res = build_actions(
                group, self.project, "test txt", "red", [MessageAction(name="TEST")], None
            )

            self._assert_message_actions_list(
                res[0],
                {"label": "Select Assignee...", "name": "assign", "type": "select", "value": None},
            )
