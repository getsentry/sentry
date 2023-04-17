from unittest.mock import Mock, patch

import pytest
from django.http import QueryDict

from sentry.api.helpers.group_index import (
    ValidationError,
    update_groups,
    validate_search_filter_permissions,
)
from sentry.api.issue_search import parse_search_query
from sentry.models import (
    GroupInbox,
    GroupInboxReason,
    GroupStatus,
    GroupSubStatus,
    add_group_to_inbox,
)
from sentry.testutils import TestCase
from sentry.testutils.helpers.features import with_feature


class ValidateSearchFilterPermissionsTest(TestCase):
    def run_test(self, query):
        validate_search_filter_permissions(self.organization, parse_search_query(query), self.user)

    def assert_analytics_recorded(self, mock_record):
        mock_record.assert_called_with(
            "advanced_search.feature_gated",
            user_id=self.user.id,
            default_user_id=self.user.id,
            organization_id=self.organization.id,
        )

    @patch("sentry.analytics.record")
    def test_negative(self, mock_record):
        query = "!has:user"
        with self.feature({"organizations:advanced-search": False}), pytest.raises(
            ValidationError, match=".*negative search.*"
        ):
            self.run_test(query)

        self.run_test(query)
        self.assert_analytics_recorded(mock_record)

        query = "!something:123"
        with self.feature({"organizations:advanced-search": False}), pytest.raises(
            ValidationError, match=".*negative search.*"
        ):
            self.run_test(query)

        self.run_test(query)
        self.assert_analytics_recorded(mock_record)

    @patch("sentry.analytics.record")
    def test_wildcard(self, mock_record):
        query = "abc:hello*"
        with self.feature({"organizations:advanced-search": False}), pytest.raises(
            ValidationError, match=".*wildcard search.*"
        ):
            self.run_test(query)

        self.run_test(query)
        self.assert_analytics_recorded(mock_record)

        query = "raw * search"
        with self.feature({"organizations:advanced-search": False}), pytest.raises(
            ValidationError, match=".*wildcard search.*"
        ):
            self.run_test(query)

        self.run_test(query)
        self.assert_analytics_recorded(mock_record)


class UpdateGroupsTest(TestCase):
    @patch("sentry.signals.issue_unresolved.send_robust")
    @patch("sentry.signals.issue_ignored.send_robust")
    def test_unresolving_resolved_group(self, send_robust, send_unresolved):
        resolved_group = self.create_group(status=GroupStatus.RESOLVED)
        assert resolved_group.status == GroupStatus.RESOLVED

        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.data = {"status": "unresolved"}
        request.GET = QueryDict(query_string=f"id={resolved_group.id}")

        search_fn = Mock()
        update_groups(
            request, request.GET.getlist("id"), [self.project], self.organization.id, search_fn
        )

        resolved_group.refresh_from_db()

        assert resolved_group.status == GroupStatus.UNRESOLVED
        assert not send_robust.called
        assert send_unresolved.called

    @patch("sentry.signals.issue_resolved.send_robust")
    def test_resolving_unresolved_group(self, send_robust):
        unresolved_group = self.create_group(status=GroupStatus.UNRESOLVED)
        add_group_to_inbox(unresolved_group, GroupInboxReason.NEW)
        assert unresolved_group.status == GroupStatus.UNRESOLVED

        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.data = {"status": "resolved"}
        request.GET = QueryDict(query_string=f"id={unresolved_group.id}")

        search_fn = Mock()
        update_groups(
            request, request.GET.getlist("id"), [self.project], self.organization.id, search_fn
        )

        unresolved_group.refresh_from_db()

        assert unresolved_group.status == GroupStatus.RESOLVED
        assert not GroupInbox.objects.filter(group=unresolved_group).exists()
        assert send_robust.called

    @patch("sentry.signals.issue_ignored.send_robust")
    def test_ignoring_group(self, send_robust):
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.NEW)

        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.data = {"status": "ignored"}
        request.GET = QueryDict(query_string=f"id={group.id}")

        search_fn = Mock()
        update_groups(
            request, request.GET.getlist("id"), [self.project], self.organization.id, search_fn
        )

        group.refresh_from_db()

        assert group.status == GroupStatus.IGNORED
        assert send_robust.called
        assert not GroupInbox.objects.filter(group=group).exists()

    @patch("sentry.signals.issue_unignored.send_robust")
    def test_unignoring_group(self, send_robust):
        group = self.create_group(status=GroupStatus.IGNORED)

        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.data = {"status": "unresolved"}
        request.GET = QueryDict(query_string=f"id={group.id}")

        search_fn = Mock()
        update_groups(
            request, request.GET.getlist("id"), [self.project], self.organization.id, search_fn
        )

        group.refresh_from_db()

        assert group.status == GroupStatus.UNRESOLVED
        assert send_robust.called

    @patch("sentry.signals.issue_mark_reviewed.send_robust")
    def test_mark_reviewed_group(self, send_robust):
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.NEW)

        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.data = {"inbox": False}
        request.GET = QueryDict(query_string=f"id={group.id}")

        search_fn = Mock()
        update_groups(
            request, request.GET.getlist("id"), [self.project], self.organization.id, search_fn
        )

        group.refresh_from_db()

        assert not GroupInbox.objects.filter(group=group).exists()
        assert send_robust.called

    @with_feature("organizations:escalating-issues")
    @patch("sentry.signals.issue_ignored.send_robust")
    def test_ignore_with_substatus_until_escalating(self, send_robust):
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.NEW)

        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.data = {"status": "ignored", "substatus": "until_escalating"}
        request.GET = QueryDict(query_string=f"id={group.id}")

        search_fn = Mock()
        update_groups(
            request, request.GET.getlist("id"), [self.project], self.organization.id, search_fn
        )

        group.refresh_from_db()

        assert group.status == GroupStatus.IGNORED
        assert group.substatus == GroupSubStatus.UNTIL_ESCALATING
        assert send_robust.called
        assert not GroupInbox.objects.filter(group=group).exists()
