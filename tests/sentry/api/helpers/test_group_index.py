from datetime import UTC, datetime, timedelta
from time import time
from unittest.mock import MagicMock, Mock, patch

import pytest
from django.http import QueryDict

from sentry.api.helpers.group_index import update_groups, validate_search_filter_permissions
from sentry.api.helpers.group_index.delete import delete_groups
from sentry.api.helpers.group_index.update import (
    handle_assigned_to,
    handle_has_seen,
    handle_is_bookmarked,
    handle_is_public,
    handle_is_subscribed,
)
from sentry.api.helpers.group_index.validators import ValidationError
from sentry.api.issue_search import parse_search_query
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupbookmark import GroupBookmark
from sentry.models.grouphash import GroupHash
from sentry.models.groupinbox import GroupInbox, GroupInboxReason, add_group_to_inbox
from sentry.models.groupseen import GroupSeen
from sentry.models.groupshare import GroupShare
from sentry.models.groupsnooze import GroupSnooze
from sentry.models.groupsubscription import GroupSubscription
from sentry.notifications.types import GroupSubscriptionReason
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.types.actor import Actor
from sentry.types.group import GroupSubStatus

pytestmark = [requires_snuba]


class ValidateSearchFilterPermissionsTest(TestCase):
    def run_test(self, query: str) -> None:
        validate_search_filter_permissions(self.organization, parse_search_query(query), self.user)

    def assert_analytics_recorded(self, mock_record: Mock) -> None:
        mock_record.assert_called_with(
            "advanced_search.feature_gated",
            user_id=self.user.id,
            default_user_id=self.user.id,
            organization_id=self.organization.id,
        )

    @patch("sentry.analytics.record")
    def test_negative(self, mock_record: Mock) -> None:
        query = "!has:user"
        with (
            self.feature({"organizations:advanced-search": False}),
            pytest.raises(ValidationError, match=".*negative search.*"),
        ):
            self.run_test(query)

        self.run_test(query)
        self.assert_analytics_recorded(mock_record)

        query = "!something:123"
        with (
            self.feature({"organizations:advanced-search": False}),
            pytest.raises(ValidationError, match=".*negative search.*"),
        ):
            self.run_test(query)

        self.run_test(query)
        self.assert_analytics_recorded(mock_record)

    @patch("sentry.analytics.record")
    def test_wildcard(self, mock_record: Mock) -> None:
        query = "abc:hello*"
        with (
            self.feature({"organizations:advanced-search": False}),
            pytest.raises(ValidationError, match=".*wildcard search.*"),
        ):
            self.run_test(query)

        self.run_test(query)
        self.assert_analytics_recorded(mock_record)

        query = "raw * search"
        with (
            self.feature({"organizations:advanced-search": False}),
            pytest.raises(ValidationError, match=".*wildcard search.*"),
        ):
            self.run_test(query)

        self.run_test(query)
        self.assert_analytics_recorded(mock_record)


class UpdateGroupsTest(TestCase):
    @patch("sentry.signals.issue_unresolved.send_robust")
    @patch("sentry.signals.issue_ignored.send_robust")
    def test_unresolving_resolved_group(self, send_robust: Mock, send_unresolved: Mock) -> None:
        resolved_group = self.create_group(status=GroupStatus.RESOLVED)
        assert resolved_group.status == GroupStatus.RESOLVED

        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.data = {"status": "unresolved", "substatus": "ongoing"}
        request.GET = QueryDict(query_string=f"id={resolved_group.id}")

        update_groups(request, request.GET.getlist("id"), [self.project], self.organization.id)

        resolved_group.refresh_from_db()

        assert resolved_group.status == GroupStatus.UNRESOLVED
        assert resolved_group.substatus == GroupSubStatus.ONGOING
        assert not send_robust.called
        assert send_unresolved.called

    @patch("sentry.signals.issue_resolved.send_robust")
    def test_resolving_unresolved_group(self, send_robust: Mock) -> None:
        unresolved_group = self.create_group(status=GroupStatus.UNRESOLVED)
        add_group_to_inbox(unresolved_group, GroupInboxReason.NEW)
        assert unresolved_group.status == GroupStatus.UNRESOLVED

        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.data = {"status": "resolved", "substatus": None}
        request.GET = QueryDict(query_string=f"id={unresolved_group.id}")

        update_groups(request, request.GET.getlist("id"), [self.project], self.organization.id)

        unresolved_group.refresh_from_db()

        assert unresolved_group.status == GroupStatus.RESOLVED
        assert not GroupInbox.objects.filter(group=unresolved_group).exists()
        assert send_robust.called

    @patch("sentry.signals.issue_ignored.send_robust")
    @patch("sentry.issues.status_change.post_save")
    def test_ignoring_group_archived_forever(self, post_save: Mock, send_robust: Mock) -> None:
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.NEW)

        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.data = {"status": "ignored", "substatus": "archived_forever"}
        request.GET = QueryDict(query_string=f"id={group.id}")

        update_groups(request, request.GET.getlist("id"), [self.project], self.organization.id)

        group.refresh_from_db()

        assert group.status == GroupStatus.IGNORED
        assert group.substatus == GroupSubStatus.FOREVER
        assert send_robust.called
        post_save.send.assert_called_with(
            sender=Group,
            instance=group,
            created=False,
            update_fields=["status", "substatus"],
        )
        assert not GroupInbox.objects.filter(group=group).exists()

    @patch("sentry.signals.issue_ignored.send_robust")
    def test_ignoring_group_archived_until_condition_met(self, send_robust: Mock) -> None:
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.NEW)

        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.data = {
            "status": "ignored",
            "substatus": "archived_until_condition_met",
            "statusDetails": {"ignoreDuration": 1},
        }
        request.GET = QueryDict(query_string=f"id={group.id}")

        update_groups(request, request.GET.getlist("id"), [self.project], self.organization.id)

        group.refresh_from_db()

        assert group.status == GroupStatus.IGNORED
        assert group.substatus == GroupSubStatus.UNTIL_CONDITION_MET
        assert send_robust.called
        assert not GroupInbox.objects.filter(group=group).exists()
        assert GroupSnooze.objects.filter(group=group).exists()

    @patch("sentry.signals.issue_unignored.send_robust")
    def test_unignoring_group(self, send_robust: Mock) -> None:
        for data in [
            {
                "group": self.create_group(
                    status=GroupStatus.IGNORED, first_seen=datetime.now(UTC) - timedelta(days=8)
                ),
                "request_data": {"status": "unresolved"},
                "expected_substatus": GroupSubStatus.ONGOING,
            },
            {
                "group": self.create_group(
                    status=GroupStatus.IGNORED, first_seen=datetime.now(UTC) - timedelta(days=8)
                ),
                "request_data": {"status": "unresolved", "substatus": "ongoing"},
                "expected_substatus": GroupSubStatus.ONGOING,
            },
            {
                "group": self.create_group(
                    status=GroupStatus.IGNORED, first_seen=datetime.now(UTC)
                ),
                "request_data": {"status": "unresolved"},
                "expected_substatus": GroupSubStatus.NEW,
            },
        ]:
            group = data["group"]
            request = self.make_request(user=self.user, method="GET")
            request.user = self.user
            request.data = data["request_data"]
            request.GET = QueryDict(query_string=f"id={group.id}")

            update_groups(request, request.GET.getlist("id"), [self.project], self.organization.id)

            group.refresh_from_db()

            assert group.status == GroupStatus.UNRESOLVED
            assert group.substatus == data["expected_substatus"]
            assert send_robust.called

    @patch("sentry.signals.issue_mark_reviewed.send_robust")
    def test_mark_reviewed_group(self, send_robust: Mock) -> None:
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.NEW)

        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.data = {"inbox": False}
        request.GET = QueryDict(query_string=f"id={group.id}")

        update_groups(request, request.GET.getlist("id"), [self.project], self.organization.id)

        group.refresh_from_db()

        assert not GroupInbox.objects.filter(group=group).exists()
        assert send_robust.called

    @patch("sentry.signals.issue_ignored.send_robust")
    def test_ignore_with_substatus_archived_until_escalating(self, send_robust: Mock) -> None:
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.NEW)

        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.data = {"status": "ignored", "substatus": "archived_until_escalating"}
        request.GET = QueryDict(query_string=f"id={group.id}")

        update_groups(request, request.GET.getlist("id"), [self.project], self.organization.id)

        group.refresh_from_db()

        assert group.status == GroupStatus.IGNORED
        assert group.substatus == GroupSubStatus.UNTIL_ESCALATING
        assert send_robust.called
        assert not GroupInbox.objects.filter(group=group).exists()


class MergeGroupsTest(TestCase):
    @patch("sentry.api.helpers.group_index.update.handle_merge")
    def test_simple(self, mock_handle_merge: MagicMock):
        group_ids = [self.create_group().id, self.create_group().id]
        project = self.project

        request = self.make_request(method="PUT")
        request.user = self.user
        request.data = {"merge": 1}
        request.GET = {"id": group_ids, "project": [project.id]}

        update_groups(request, group_ids, [project], self.organization.id)

        call_args = mock_handle_merge.call_args.args

        assert len(call_args) == 3
        # Have to convert to ids because first argument is a queryset
        assert [group.id for group in call_args[0]] == group_ids
        assert call_args[1] == {project.id: project}
        assert call_args[2] == self.user

    @patch("sentry.api.helpers.group_index.update.handle_merge")
    def test_multiple_projects(self, mock_handle_merge: MagicMock):
        project1 = self.create_project()
        project2 = self.create_project()
        projects = [project1, project2]
        project_ids = [project.id for project in projects]

        group_ids = [
            self.create_group(project1).id,
            self.create_group(project2).id,
        ]

        request = self.make_request(method="PUT")
        request.user = self.user
        request.data = {"merge": 1}
        request.GET = {"id": group_ids, "project": project_ids}

        response = update_groups(request, group_ids, projects, self.organization.id)

        assert response.data == {"detail": "Merging across multiple projects is not supported"}
        assert response.status_code == 400
        assert mock_handle_merge.call_count == 0

    @patch("sentry.api.helpers.group_index.update.handle_merge")
    def test_multiple_groups_same_project(self, mock_handle_merge: MagicMock):
        """Even if the UI calls with multiple projects, if the groups belong to the same project, we should merge them."""
        projects = [self.create_project(), self.create_project()]
        proj1 = projects[0]
        groups = [self.create_group(proj1), self.create_group(proj1)]
        group_ids = [g.id for g in groups]
        project_ids = [p.id for p in projects]

        request = self.make_request(method="PUT")
        request.user = self.user
        request.data = {"merge": 1}
        # The two groups belong to the same project, so we should be able to merge them, even though
        # we're passing multiple project ids
        request.GET = {"id": group_ids, "project": project_ids}

        update_groups(request, group_ids, projects, self.organization.id)

        call_args = mock_handle_merge.call_args.args

        assert len(call_args) == 3
        # Have to convert to ids because first argument is a queryset
        assert [group.id for group in call_args[0]] == group_ids
        assert call_args[1] == {proj1.id: proj1}
        assert call_args[2] == self.user

    @patch("sentry.api.helpers.group_index.update.handle_merge")
    def test_no_project_ids_passed(self, mock_handle_merge: MagicMock):
        """If 'All Projects' is selected in the issue stream, the UI doesn't send project ids, but
        we should be able to derive them from the given group ids."""
        group_ids = [self.create_group().id, self.create_group().id]
        project = self.project

        request = self.make_request(method="PUT")
        request.user = self.user
        request.data = {"merge": 1}
        request.GET = {"id": group_ids}

        update_groups(request, group_ids, [project], self.organization.id)

        call_args = mock_handle_merge.call_args.args

        assert len(call_args) == 3
        # Have to convert to ids because first argument is a queryset
        assert [group.id for group in call_args[0]] == group_ids
        assert call_args[1] == {project.id: project}
        assert call_args[2] == self.user

    def test_metrics(self):
        for referer, expected_referer_tag in [
            ("https://sentry.io/organizations/dogsaregreat/issues/", "issue stream"),
            ("https://dogsaregreat.sentry.io/issues/", "issue stream"),
            (
                "https://sentry.io/organizations/dogsaregreat/issues/12311121/similar/",
                "similar issues tab",
            ),
            (
                "https://dogsaregreat.sentry.io/issues/12311121/similar/",
                "similar issues tab",
            ),
            (
                "https://sentry.io/organizations/dogsaregreat/some/other/path/",
                "unknown",
            ),
            (
                "https://dogsaregreat.sentry.io/some/other/path/",
                "unknown",
            ),
            (
                "",
                "unknown",
            ),
        ]:
            group_ids = [
                self.create_group(
                    platform="javascript",
                    metadata={"sdk": {"name_normalized": "sentry.javascript.nextjs"}},
                ).id,
                self.create_group(platform="javascript").id,
            ]
            project = self.project

            request = self.make_request(method="PUT")
            request.user = self.user
            request.data = {"merge": 1}
            request.GET = {"id": group_ids, "project": [project.id]}
            request.META = {"HTTP_REFERER": referer}

            with patch("sentry.api.helpers.group_index.update.metrics.incr") as mock_metrics_incr:
                update_groups(request, group_ids, [project], self.organization.id)

                mock_metrics_incr.assert_any_call(
                    "grouping.merge_issues",
                    sample_rate=1.0,
                    tags={
                        "platform": "javascript",
                        "referer": expected_referer_tag,
                        "sdk": "sentry.javascript.nextjs",
                    },
                )


class TestHandleIsSubscribed(TestCase):
    def setUp(self) -> None:
        self.group = self.create_group()
        self.group_list = [self.group]
        self.project_lookup = {self.group.project_id: self.group.project}

    def test_is_subscribed(self) -> None:
        resp = handle_is_subscribed(True, self.group_list, self.project_lookup, self.user)

        assert GroupSubscription.objects.filter(group=self.group, user_id=self.user.id).exists()
        assert resp["reason"] == "unknown"

    def test_is_subscribed_updates(self) -> None:
        GroupSubscription.objects.create(
            group=self.group, project=self.group.project, user_id=self.user.id, is_active=False
        )

        resp = handle_is_subscribed(True, self.group_list, self.project_lookup, self.user)

        subscription = GroupSubscription.objects.filter(group=self.group, user_id=self.user.id)
        assert subscription.exists()
        assert subscription.first().is_active
        assert resp["reason"] == "unknown"


class TestHandleIsBookmarked(TestCase):
    def setUp(self) -> None:
        self.group = self.create_group()
        self.group_list = [self.group]
        self.group_ids = [self.group]
        self.project_lookup = {self.group.project_id: self.group.project}

    def test_is_bookmarked(self) -> None:
        handle_is_bookmarked(True, self.group_list, self.project_lookup, self.user)

        assert GroupBookmark.objects.filter(group=self.group, user_id=self.user.id).exists()
        assert GroupSubscription.objects.filter(
            group=self.group, user_id=self.user.id, reason=GroupSubscriptionReason.bookmark
        ).exists()

    def test_not_is_bookmarked(self) -> None:
        GroupBookmark.objects.create(
            group=self.group, user_id=self.user.id, project_id=self.group.project_id
        )
        GroupSubscription.objects.create(
            project=self.group.project,
            group=self.group,
            user_id=self.user.id,
            reason=GroupSubscriptionReason.bookmark,
        )
        handle_is_bookmarked(False, self.group_list, self.project_lookup, self.user)

        assert not GroupBookmark.objects.filter(group=self.group, user_id=self.user.id).exists()
        assert not GroupSubscription.objects.filter(group=self.group, user_id=self.user.id).exists()


class TestHandleHasSeen(TestCase):
    def setUp(self) -> None:
        self.group = self.create_group()
        self.group_list = [self.group]
        self.project_lookup = {self.group.project_id: self.group.project}

    def test_has_seen(self) -> None:
        handle_has_seen(True, self.group_list, self.project_lookup, [self.project], self.user)

        assert GroupSeen.objects.filter(group=self.group, user_id=self.user.id).exists()

    def test_not_has_seen(self) -> None:
        GroupSeen.objects.create(
            group=self.group, user_id=self.user.id, project_id=self.group.project_id
        )

        handle_has_seen(False, self.group_list, self.project_lookup, [self.project], self.user)

        assert not GroupSeen.objects.filter(group=self.group, user_id=self.user.id).exists()


class TestHandleIsPublic(TestCase):
    def setUp(self) -> None:
        self.group = self.create_group()
        self.group_list = [self.group]
        self.project_lookup = {self.group.project_id: self.group.project}

    def test_is_public(self) -> None:
        share_id = handle_is_public(True, self.group_list, self.project_lookup, self.user)

        new_share = GroupShare.objects.get(group=self.group)
        assert Activity.objects.filter(
            group=self.group, type=ActivityType.SET_PUBLIC.value
        ).exists()
        assert not Activity.objects.filter(
            group=self.group, type=ActivityType.SET_PRIVATE.value
        ).exists()

        assert share_id == new_share.uuid

    def test_is_public_existing_shares(self) -> None:
        share = GroupShare.objects.create(group=self.group, project=self.group.project)

        share_id = handle_is_public(True, self.group_list, self.project_lookup, self.user)

        new_share = GroupShare.objects.get(group=self.group)
        assert Activity.objects.filter(
            group=self.group, type=ActivityType.SET_PRIVATE.value
        ).exists()
        assert new_share != share
        assert Activity.objects.filter(
            group=self.group, type=ActivityType.SET_PUBLIC.value
        ).exists()
        assert share_id == new_share.uuid

    def test_not_is_public(self) -> None:
        GroupShare.objects.create(group=self.group, project=self.group.project)

        share_id = handle_is_public(False, self.group_list, self.project_lookup, self.user)
        assert Activity.objects.filter(
            group=self.group, type=ActivityType.SET_PRIVATE.value
        ).exists()
        assert not GroupShare.objects.filter(group=self.group).exists()
        assert not Activity.objects.filter(
            group=self.group, type=ActivityType.SET_PUBLIC.value
        ).exists()
        assert share_id is None


class TestHandleAssignedTo(TestCase):
    def setUp(self) -> None:
        self.group = self.create_group()
        self.group_list = [self.group]
        self.project_lookup = {self.group.project_id: self.group.project}

    @patch("sentry.analytics.record")
    def test_assigned_to(self, mock_record: Mock) -> None:
        assigned_to = handle_assigned_to(
            Actor.from_identifier(self.user.id),
            None,
            None,
            self.group_list,
            self.project_lookup,
            self.user,
        )

        assert GroupAssignee.objects.filter(group=self.group, user_id=self.user.id).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=self.user.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        assert assigned_to == {
            "email": self.user.email,
            "id": str(self.user.id),
            "name": self.user.username,
            "type": "user",
        }
        mock_record.assert_called_with(
            "manual.issue_assignment",
            group_id=self.group.id,
            organization_id=self.group.project.organization_id,
            project_id=self.group.project_id,
            assigned_by=None,
            had_to_deassign=False,
        )

    @patch("sentry.analytics.record")
    def test_unassign(self, mock_record: Mock) -> None:
        # first assign the issue
        handle_assigned_to(
            Actor.from_identifier(self.user.id),
            None,
            None,
            self.group_list,
            self.project_lookup,
            self.user,
        )
        assert GroupAssignee.objects.filter(group=self.group, user_id=self.user.id).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=self.user.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        # then unassign it
        assigned_to = handle_assigned_to(
            None, None, None, self.group_list, self.project_lookup, self.user
        )

        assert not GroupAssignee.objects.filter(group=self.group, user_id=self.user.id).exists()
        assert not GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=self.user.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        assert assigned_to is None
        mock_record.assert_called_with(
            "manual.issue_assignment",
            group_id=self.group.id,
            organization_id=self.group.project.organization_id,
            project_id=self.group.project_id,
            assigned_by=None,
            had_to_deassign=True,
        )

    @patch("sentry.analytics.record")
    def test_unassign_team(self, mock_record: Mock) -> None:
        user1 = self.create_user("foo@example.com")
        user2 = self.create_user("bar@example.com")
        team1 = self.create_team()
        member1 = self.create_member(user=user1, organization=self.organization, role="member")
        member2 = self.create_member(user=user2, organization=self.organization, role="member")
        self.create_team_membership(team1, member1, role="admin")
        self.create_team_membership(team1, member2, role="admin")

        # first assign the issue to team1
        assigned_to = handle_assigned_to(
            Actor.from_identifier(f"team:{team1.id}"),
            None,
            None,
            self.group_list,
            self.project_lookup,
            self.user,
        )

        assert GroupAssignee.objects.filter(group=self.group, team_id=team1.id).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user1.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user2.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        # then unassign it
        assigned_to = handle_assigned_to(
            None, None, None, self.group_list, self.project_lookup, self.user
        )

        assert not GroupAssignee.objects.filter(group=self.group, team_id=team1.id).exists()
        assert not GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user1.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()
        assert not GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user2.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        assert assigned_to is None
        mock_record.assert_called_with(
            "manual.issue_assignment",
            group_id=self.group.id,
            organization_id=self.group.project.organization_id,
            project_id=self.group.project_id,
            assigned_by=None,
            had_to_deassign=True,
        )

    @patch("sentry.analytics.record")
    @with_feature("organizations:team-workflow-notifications")
    def test_unassign_team_with_team_workflow_notifications_flag(self, mock_record: Mock) -> None:
        user1 = self.create_user("foo@example.com")
        user2 = self.create_user("bar@example.com")
        team1 = self.create_team()
        member1 = self.create_member(user=user1, organization=self.organization, role="member")
        member2 = self.create_member(user=user2, organization=self.organization, role="member")
        self.create_team_membership(team1, member1, role="admin")
        self.create_team_membership(team1, member2, role="admin")

        # first assign the issue to team1
        assigned_to = handle_assigned_to(
            Actor.from_identifier(f"team:{team1.id}"),
            None,
            None,
            self.group_list,
            self.project_lookup,
            self.user,
        )

        assert GroupAssignee.objects.filter(group=self.group, team_id=team1.id).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            team_id=team1.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        # then unassign it
        assigned_to = handle_assigned_to(
            None, None, None, self.group_list, self.project_lookup, self.user
        )

        assert not GroupAssignee.objects.filter(group=self.group, team_id=team1.id).exists()
        assert not GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=team1.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        assert assigned_to is None
        mock_record.assert_called_with(
            "manual.issue_assignment",
            group_id=self.group.id,
            organization_id=self.group.project.organization_id,
            project_id=self.group.project_id,
            assigned_by=None,
            had_to_deassign=True,
        )

    @patch("sentry.analytics.record")
    def test_reassign_user(self, mock_record: Mock) -> None:
        user2 = self.create_user(email="meow@meow.meow")

        # first assign the issue
        assigned_to = handle_assigned_to(
            Actor.from_identifier(self.user.id),
            None,
            None,
            self.group_list,
            self.project_lookup,
            self.user,
        )

        assert GroupAssignee.objects.filter(group=self.group, user_id=self.user.id).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=self.user.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        # then assign it to someone else
        assigned_to = handle_assigned_to(
            Actor.from_identifier(user2.id),
            None,
            None,
            self.group_list,
            self.project_lookup,
            self.user,
        )

        assert not GroupAssignee.objects.filter(group=self.group, user_id=self.user.id).exists()
        assert not GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=self.user.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()
        assert GroupAssignee.objects.filter(group=self.group, user_id=user2.id).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user2.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        assert assigned_to == {
            "email": user2.email,
            "id": str(user2.id),
            "name": user2.username,
            "type": "user",
        }
        mock_record.assert_called_with(
            "manual.issue_assignment",
            group_id=self.group.id,
            organization_id=self.group.project.organization_id,
            project_id=self.group.project_id,
            assigned_by=None,
            had_to_deassign=True,
        )
        # pass assignedTo but it's the same as the existing assignee
        assigned_to = handle_assigned_to(
            Actor.from_identifier(user2.id),
            None,
            None,
            self.group_list,
            self.project_lookup,
            self.user,
        )
        # assert nothing has changed
        assert not GroupAssignee.objects.filter(group=self.group, user_id=self.user.id).exists()
        assert not GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=self.user.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()
        assert GroupAssignee.objects.filter(group=self.group, user_id=user2.id).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user2.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        assert assigned_to == {
            "email": user2.email,
            "id": str(user2.id),
            "name": user2.username,
            "type": "user",
        }
        mock_record.assert_called_with(
            "manual.issue_assignment",
            group_id=self.group.id,
            organization_id=self.group.project.organization_id,
            project_id=self.group.project_id,
            assigned_by=None,
            had_to_deassign=False,
        )

    @patch("sentry.analytics.record")
    def test_reassign_team(self, mock_record: Mock) -> None:
        user1 = self.create_user("foo@example.com")
        user2 = self.create_user("bar@example.com")
        team1 = self.create_team()
        member1 = self.create_member(user=user1, organization=self.organization, role="member")
        member2 = self.create_member(user=user2, organization=self.organization, role="member")
        self.create_team_membership(team1, member1, role="admin")
        self.create_team_membership(team1, member2, role="admin")

        user3 = self.create_user("baz@example.com")
        user4 = self.create_user("boo@example.com")
        team2 = self.create_team()
        member3 = self.create_member(user=user3, organization=self.organization, role="member")
        member4 = self.create_member(user=user4, organization=self.organization, role="member")
        self.create_team_membership(team2, member3, role="admin")
        self.create_team_membership(team2, member4, role="admin")

        # first assign the issue to team1
        assigned_to = handle_assigned_to(
            Actor.from_identifier(f"team:{team1.id}"),
            None,
            None,
            self.group_list,
            self.project_lookup,
            self.user,
        )

        assert GroupAssignee.objects.filter(group=self.group, team=team1.id).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user1.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user2.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        # then assign it to team2
        assigned_to = handle_assigned_to(
            Actor.from_identifier(f"team:{team2.id}"),
            None,
            None,
            self.group_list,
            self.project_lookup,
            self.user,
        )

        assert not GroupAssignee.objects.filter(group=self.group, team=team1.id).exists()
        assert not GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user1.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()
        assert not GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user2.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        assert GroupAssignee.objects.filter(group=self.group, team=team2.id).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user3.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user4.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        assert assigned_to == {
            "id": str(team2.id),
            "name": team2.slug,
            "type": "team",
        }
        mock_record.assert_called_with(
            "manual.issue_assignment",
            group_id=self.group.id,
            organization_id=self.group.project.organization_id,
            project_id=self.group.project_id,
            assigned_by=None,
            had_to_deassign=True,
        )

    @patch("sentry.analytics.record")
    @with_feature("organizations:team-workflow-notifications")
    def test_reassign_team_with_team_workflow_notifications_flag(self, mock_record: Mock) -> None:
        user1 = self.create_user("foo@example.com")
        user2 = self.create_user("bar@example.com")
        team1 = self.create_team()
        member1 = self.create_member(user=user1, organization=self.organization, role="member")
        member2 = self.create_member(user=user2, organization=self.organization, role="member")
        self.create_team_membership(team1, member1, role="admin")
        self.create_team_membership(team1, member2, role="admin")

        user3 = self.create_user("baz@example.com")
        user4 = self.create_user("boo@example.com")
        team2 = self.create_team()
        member3 = self.create_member(user=user3, organization=self.organization, role="member")
        member4 = self.create_member(user=user4, organization=self.organization, role="member")
        self.create_team_membership(team2, member3, role="admin")
        self.create_team_membership(team2, member4, role="admin")

        # first assign the issue to team1
        assigned_to = handle_assigned_to(
            Actor.from_identifier(f"team:{team1.id}"),
            None,
            None,
            self.group_list,
            self.project_lookup,
            self.user,
        )

        assert GroupAssignee.objects.filter(group=self.group, team=team1.id).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            team=team1,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        # then assign it to team2
        assigned_to = handle_assigned_to(
            Actor.from_identifier(f"team:{team2.id}"),
            None,
            None,
            self.group_list,
            self.project_lookup,
            self.user,
        )

        assert not GroupAssignee.objects.filter(group=self.group, team=team1.id).exists()
        assert not GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            team=team1,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        assert GroupAssignee.objects.filter(group=self.group, team=team2.id).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            team=team2,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        assert assigned_to == {
            "id": str(team2.id),
            "name": team2.slug,
            "type": "team",
        }
        mock_record.assert_called_with(
            "manual.issue_assignment",
            group_id=self.group.id,
            organization_id=self.group.project.organization_id,
            project_id=self.group.project_id,
            assigned_by=None,
            had_to_deassign=True,
        )

    def test_user_in_reassigned_team(self):
        """Test that the correct participants are present when re-assigning from user to team and vice versa"""
        user1 = self.create_user("foo@example.com")
        user2 = self.create_user("bar@example.com")
        team1 = self.create_team()
        member1 = self.create_member(user=user1, organization=self.organization, role="member")
        member2 = self.create_member(user=user2, organization=self.organization, role="member")
        self.create_team_membership(team1, member1, role="admin")
        self.create_team_membership(team1, member2, role="admin")

        # assign the issue to the team
        assigned_to = handle_assigned_to(
            Actor.from_identifier(f"team:{team1.id}"),
            None,
            None,
            self.group_list,
            self.project_lookup,
            self.user,
        )

        assert GroupAssignee.objects.filter(group=self.group, team=team1.id).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user1.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user2.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        # then assign it to user1
        assigned_to = handle_assigned_to(
            Actor.from_identifier(user1.id),
            None,
            None,
            self.group_list,
            self.project_lookup,
            self.user,
        )

        assert GroupAssignee.objects.filter(group=self.group, user_id=user1.id).exists()
        assert not GroupAssignee.objects.filter(group=self.group, team=team1.id).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user1.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()
        assert not GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user2.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()

        assert assigned_to == {
            "email": user1.email,
            "id": str(user1.id),
            "name": user1.username,
            "type": "user",
        }

        # assign the issue back to the team
        assigned_to = handle_assigned_to(
            Actor.from_identifier(f"team:{team1.id}"),
            None,
            None,
            self.group_list,
            self.project_lookup,
            self.user,
        )
        assert GroupAssignee.objects.filter(group=self.group, team=team1.id).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user1.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()
        assert GroupSubscription.objects.filter(
            group=self.group,
            project=self.group.project,
            user_id=user2.id,
            reason=GroupSubscriptionReason.assigned,
        ).exists()


class DeleteGroupsTest(TestCase):
    @patch("sentry.signals.issue_deleted.send_robust")
    def test_delete_groups_simple(self, send_robust: Mock):
        groups = [self.create_group(), self.create_group()]
        group_ids = [group.id for group in groups]
        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.GET = QueryDict(f"id={group_ids[0]}&id={group_ids[1]}")
        hashes = ["0" * 32, "1" * 32]
        for i, group in enumerate(groups):
            GroupHash.objects.create(project=self.project, group=group, hash=hashes[i])
            add_group_to_inbox(group, GroupInboxReason.NEW)

        delete_groups(request, [self.project], self.organization.id)

        assert (
            len(GroupHash.objects.filter(project_id=self.project.id, group_id__in=group_ids).all())
            == 0
        )
        assert (
            len(GroupInbox.objects.filter(project_id=self.project.id, group_id__in=group_ids).all())
            == 0
        )
        assert send_robust.called

    @patch(
        "sentry.tasks.delete_seer_grouping_records.delete_seer_grouping_records_by_hash.apply_async"
    )
    @patch("sentry.tasks.delete_seer_grouping_records.logger")
    @patch("sentry.signals.issue_deleted.send_robust")
    def test_delete_groups_deletes_seer_records_by_hash(
        self, send_robust: Mock, mock_logger: Mock, mock_delete_seer_grouping_records_by_hash
    ):
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        groups = [self.create_group(), self.create_group()]
        group_ids = [group.id for group in groups]
        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.GET = QueryDict(f"id={group_ids[0]}&id={group_ids[1]}")
        hashes = ["0" * 32, "1" * 32]
        for i, group in enumerate(groups):
            GroupHash.objects.create(project=self.project, group=group, hash=hashes[i])
            add_group_to_inbox(group, GroupInboxReason.NEW)

        delete_groups(request, [self.project], self.organization.id)

        assert (
            len(GroupHash.objects.filter(project_id=self.project.id, group_id__in=group_ids).all())
            == 0
        )
        assert (
            len(GroupInbox.objects.filter(project_id=self.project.id, group_id__in=group_ids).all())
            == 0
        )
        assert send_robust.called
        mock_logger.info.assert_called_with(
            "calling seer record deletion by hash",
            extra={"project_id": self.project.id, "hashes": hashes},
        )
        mock_delete_seer_grouping_records_by_hash.assert_called_with(
            args=[self.project.id, hashes, 0]
        )
