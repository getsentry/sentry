import datetime
from unittest.mock import patch

from django.db import connections, router
from django.test.utils import CaptureQueriesContext

from sentry.integrations.models.external_issue import ExternalIssue
from sentry.issues.action_log.read_metrics import ActivityReadResult
from sentry.issues.action_log.types import GroupActionType, GroupActorType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.groupsubscription import GroupSubscription
from sentry.notifications.types import GroupSubscriptionReason
from sentry.silo.base import SiloMode
from sentry.tasks.merge import merge_groups
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.action_log import action_log_activity_enabled
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.utils.action_log.activity_translator import activity_action_idempotency_key

pytestmark = [requires_snuba]


@with_feature({"projects:issue-action-log-write-to-db": False})
class GroupNoteTest(APITestCase):
    def test_simple(self) -> None:
        group = self.group

        activity = self.create_group_activity(
            group=group,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "hello world"},
        )

        self.login_as(user=self.user)

        for flag_enabled in (False, True):
            for url in (
                f"/api/0/issues/{group.id}/comments/",
                f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/comments/",
            ):
                with (
                    self.feature({"projects:issue-action-log-activity": flag_enabled}),
                    patch("sentry.issues.derived.gate.is_backfilled", return_value=False),
                    patch(
                        "sentry.issues.endpoints.group_notes.record_activity_read"
                    ) as record_read,
                ):
                    response = self.client.get(url, format="json")
                assert response.status_code == 200, response.content
                assert len(response.data) == 1
                assert response.data[0]["id"] == str(activity.id)
                assert response.data[0]["commentId"] == str(activity.id)
                assert response.data[0]["data"] == {
                    "text": "hello world",
                    "comment_id": activity.id,
                }
                assert response.data[0]["source"] is None
                assert record_read.call_count == 1
                assert record_read.call_args.args[1] == ActivityReadResult.ACTIVITY

    def test_note_merge(self) -> None:
        """Test that when 2 (or more) issues with comments are merged, the chronological order of the comments are preserved."""
        now = datetime.datetime.now(datetime.UTC)

        project1 = self.create_project()
        event1 = self.store_event(data={}, project_id=project1.id)
        assert event1.group is not None
        group1 = event1.group
        note1 = Activity.objects.create(
            group=group1,
            project=project1,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "This looks bad :)"},
            datetime=now - datetime.timedelta(days=70),
        )
        note2 = Activity.objects.create(
            group=group1,
            project=project1,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "Yeah we should probably look into this"},
            datetime=now - datetime.timedelta(days=66),
        )

        project2 = self.create_project()
        group2 = self.create_group(project2)

        note3 = Activity.objects.create(
            group=group2,
            project=project2,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "I have been a good Sentry :)"},
            datetime=now - datetime.timedelta(days=90),
        )
        note4 = Activity.objects.create(
            group=group2,
            project=project2,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "You have been a bad user :)"},
            datetime=now - datetime.timedelta(days=88),
        )

        with self.tasks():
            merge_groups([group1.id], group2.id)

        assert not Group.objects.filter(id=group1.id).exists()

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group2.id}/comments/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 4

        assert response.data[0]["id"] == str(note2.id)
        assert response.data[0]["data"]["text"] == note2.data["text"]
        assert response.data[1]["id"] == str(note1.id)
        assert response.data[1]["data"]["text"] == note1.data["text"]
        assert response.data[2]["id"] == str(note4.id)
        assert response.data[2]["data"]["text"] == note4.data["text"]
        assert response.data[3]["id"] == str(note3.id)
        assert response.data[3]["data"]["text"] == note3.data["text"]

        first_page = self.client.get(url, {"per_page": 2}, format="json")
        next_url = next(
            href
            for href, attrs in parse_link_header(first_page["Link"]).items()
            if attrs["rel"] == "next"
        )
        second_page = self.client.get(next_url, format="json")
        assert [row["id"] for row in second_page.data] == [str(note4.id), str(note3.id)]
        previous_url = next(
            href
            for href, attrs in parse_link_header(second_page["Link"]).items()
            if attrs["rel"] == "previous"
        )
        assert self.client.get(previous_url, format="json").data == first_page.data

    def test_reads_activity_with_gale_source(self) -> None:
        group = self.group
        note = self.create_group_activity(
            group=group,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "current text", "external_id": "remote-comment", "mentions": []},
        )
        app = self.create_sentry_app(name="Comment Author")
        app_note = self.create_group_activity(
            group=group,
            type=ActivityType.NOTE.value,
            user_id=app.proxy_user_id,
            data={"text": "app comment"},
        )
        self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.COMMENT,
            actor_type=GroupActorType.USER,
            actor_id=self.user.id,
            data={"comment_id": note.id, "text": "stale text"},
            idempotency_key=activity_action_idempotency_key(note),
            source="mcp:claude-code",
        )
        # The same key in another group must not supply this note's source.
        self.create_group_action_log_entry(
            group=self.create_group(),
            type=GroupActionType.COMMENT,
            idempotency_key=activity_action_idempotency_key(app_note),
            source="api",
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/comments/"
        with action_log_activity_enabled():
            response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        rows = {row["commentId"]: row for row in response.data}
        result = rows[str(note.id)]
        assert result["id"] == str(note.id)
        assert result["type"] == "note"
        assert result["user"]["id"] == str(self.user.id)
        assert result["dateCreated"] == note.datetime
        assert result["data"] == {
            "text": "current text",
            "external_id": "remote-comment",
            "comment_id": note.id,
        }
        assert result["source"] == "mcp:claude-code"
        assert rows[str(app_note.id)]["sentry_app"]["id"] == str(app.id)
        assert rows[str(app_note.id)]["source"] is None

    def test_reads_current_state_despite_stale_gale(self) -> None:
        group = self.group
        edited_note = self.create_group_activity(
            group=group,
            type=ActivityType.NOTE.value,
            data={"text": "latest edit"},
        )
        deleted_note = self.create_group_activity(
            group=group, type=ActivityType.NOTE.value, data={"text": "deleted comment"}
        )
        self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.COMMENT,
            data={"comment_id": deleted_note.id, "text": "deleted comment"},
            idempotency_key=activity_action_idempotency_key(deleted_note),
        )
        deleted_note.delete()
        edited = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.COMMENT,
            actor_type=GroupActorType.USER,
            actor_id=self.user.id,
            data={"comment_id": edited_note.id, "text": "stale text"},
            idempotency_key=activity_action_idempotency_key(edited_note),
        )
        self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.COMMENT_EDIT,
            actor_type=GroupActorType.USER,
            actor_id=self.user.id,
            data={"comment_id": edited.id, "text": "first edit"},
        )
        self.create_group_activity(group=group, type=ActivityType.SET_RESOLVED.value)
        self.create_group_activity(
            group=self.create_group(), type=ActivityType.NOTE.value, data={"text": "other issue"}
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/comments/"
        with action_log_activity_enabled():
            response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content

        assert len(response.data) == 1
        assert response.data[0]["commentId"] == str(edited_note.id)
        assert response.data[0]["data"]["text"] == "latest edit"

    def test_pagination_with_tied_timestamps(self) -> None:
        now = datetime.datetime.now(datetime.UTC)
        notes = [
            self.create_group_activity(
                group=self.group,
                type=ActivityType.NOTE.value,
                data={"text": "comment"},
                datetime=timestamp,
            )
            for timestamp in (now, now, now, now - datetime.timedelta(days=1))
        ]
        self.login_as(user=self.user)
        connection = connections[router.db_for_read(GroupActionLogEntry)]
        with CaptureQueriesContext(connection) as queries:
            first_page = self.client.get(
                f"/api/0/issues/{self.group.id}/comments/", {"per_page": 2}, format="json"
            )
        assert first_page.status_code == 200
        first_ids = {row["id"] for row in first_page.data}
        assert len(first_ids) == 2
        log_queries = [q["sql"] for q in queries if 'FROM "sentry_groupactionlogentry"' in q["sql"]]
        assert len(log_queries) == 1
        assert all(f"'activity:{note_id}'" in log_queries[0] for note_id in first_ids)
        remaining_ids = {str(note.id) for note in notes} - first_ids
        assert all(f"'activity:{note_id}'" not in log_queries[0] for note_id in remaining_ids)

        next_url = next(
            href
            for href, attrs in parse_link_header(first_page["Link"]).items()
            if attrs["rel"] == "next"
        )
        second_page = self.client.get(next_url, format="json")
        assert second_page.status_code == 200
        assert {row["id"] for row in second_page.data} == remaining_ids

    def test_empty_page_skips_gale_lookup(self) -> None:
        self.login_as(user=self.user)
        group = self.group
        with CaptureQueriesContext(connections[router.db_for_read(GroupActionLogEntry)]) as queries:
            response = self.client.get(f"/api/0/issues/{group.id}/comments/", format="json")
        assert response.status_code == 200
        assert response.data == []
        assert not [q for q in queries if 'FROM "sentry_groupactionlogentry"' in q["sql"]]


class GroupNoteCreateTest(APITestCase):
    def test_simple(self) -> None:
        group = self.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/comments/"

        response = self.client.post(url, format="json")
        assert response.status_code == 400

        response = self.client.post(url, format="json", data={"text": "hello world"})
        assert response.status_code == 201, response.content

        activity = Activity.objects.get(id=response.data["id"])
        assert response.data["commentId"] == str(activity.id)
        assert activity.user_id == self.user.id
        assert activity.group == group
        assert activity.data == {"text": "hello world"}

        response = self.client.post(url, format="json", data={"text": "hello world"})
        assert response.status_code == 400, response.content

    @action_log_activity_enabled()
    def test_returns_gale(self) -> None:
        group = self.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/comments/"
        response = self.client.post(
            url,
            format="json",
            data={"text": "hello world"},
            HTTP_USER_AGENT="sentry-mcp/1.0",
            HTTP_X_SENTRY_MCP_CLIENT_FAMILY="claude-code",
        )
        assert response.status_code == 201, response.content

        activity = Activity.objects.get(
            group=group, type=ActivityType.NOTE.value, user_id=self.user.id
        )
        entry = GroupActionLogEntry.objects.get(
            group_id=group.id, type=GroupActionType.COMMENT.value
        )

        assert response.data["id"] == str(entry.id)
        assert response.data["commentId"] == str(activity.id)
        assert response.data["type"] == "note"
        assert response.data["source"] == "mcp:claude-code"
        assert response.data["user"]["id"] == str(self.user.id)
        assert response.data["data"]["text"] == "hello world"
        assert response.data["data"]["comment_id"] == activity.id

    def test_with_mentions(self) -> None:
        user_not_on_team = self.create_user(email="hello@meow.com")
        user_on_team = self.create_user(email="hello@woof.com")

        self.org = self.create_organization(name="Gnarly Org", owner=None)
        self.team = self.create_team(organization=self.org, name="Ultra Rad Team")
        self.create_member(user=self.user, organization=self.org, role="member", teams=[self.team])

        # member that IS NOT part of the team
        self.create_member(user=user_not_on_team, organization=self.org, role="member", teams=[])
        # member that IS part of the team
        self.create_member(
            user=user_on_team, organization=self.org, role="member", teams=[self.team]
        )
        group = self.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/comments/"

        # mentioning a member that does not exist returns 400
        response = self.client.post(
            url,
            format="json",
            data={"text": "**meredith@getsentry.com** is fun", "mentions": ["8888"]},
        )
        assert response.status_code == 400, response.content

        # mentioning a member in the correct team returns 201
        response = self.client.post(
            url,
            format="json",
            data={"text": "**hello@woof.com** is so fun", "mentions": [f"{user_on_team.id}"]},
        )
        assert response.status_code == 201, response.content
        assert GroupSubscription.objects.get(
            user_id=self.user.id,
            group=group,
            project=group.project,
            reason=GroupSubscriptionReason.comment,
        )
        assert not GroupSubscription.objects.filter(
            user_id=user_on_team.id,
            group=group,
            project=group.project,
            reason=GroupSubscriptionReason.mentioned,
        ).exists()

        # mentioning a member that exists but NOT in the team returns
        # validation error
        response = self.client.post(
            url,
            format="json",
            data={
                "text": "**hello@meow.com** is not so fun",
                "mentions": [f"{user_not_on_team.id}"],
            },
        )

        assert response.data == {"mentions": ["Cannot mention a non team member"]}

        # mentioning a team does NOT subscribe the team to the issue
        response = self.client.post(
            url,
            format="json",
            data={"text": "**ultra-rad-team** is so rad", "mentions": [f"team:{self.team.id}"]},
        )
        assert response.status_code == 201, response.content
        assert GroupSubscription.objects.get(
            user_id=self.user.id,
            group=group,
            project=group.project,
            reason=GroupSubscriptionReason.comment,
        )
        assert not GroupSubscription.objects.filter(
            team=self.team.id,
            group=group,
            project=group.project,
            reason=GroupSubscriptionReason.mentioned,
        ).exists()

    def test_with_group_link(self) -> None:
        group = self.group

        integration = self.create_integration(
            organization=group.organization,
            provider="example",
            external_id="123456",
            oi_params={
                "config": {
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                }
            },
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=integration.id, key="APP-123"
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        self.user.name = "Sentry Admin"
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user.save()
        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/comments/"

        with self.feature({"organizations:integrations-issue-sync": True}):
            with self.tasks():
                comment = "hello world"
                response = self.client.post(url, format="json", data={"text": comment})
                assert response.status_code == 201, response.content

                activity = Activity.objects.get(id=response.data["id"])
                assert activity.user_id == self.user.id
                assert activity.group == group
                assert activity.data == {"text": comment, "external_id": "123456789"}
