from __future__ import absolute_import

from mock import patch, Mock
from django.http import QueryDict

from sentry.models import GroupStatus
from sentry.api.helpers.group_index import (
    validate_search_filter_permissions,
    ValidationError,
    update_groups,
)
from sentry.api.issue_search import parse_search_query
from sentry.testutils import TestCase


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
        with self.feature({"organizations:advanced-search": False}), self.assertRaisesRegexp(
            ValidationError, ".*negative search.*"
        ):
            self.run_test(query)

        self.run_test(query)
        self.assert_analytics_recorded(mock_record)

        query = "!something:123"
        with self.feature({"organizations:advanced-search": False}), self.assertRaisesRegexp(
            ValidationError, ".*negative search.*"
        ):
            self.run_test(query)

        self.run_test(query)
        self.assert_analytics_recorded(mock_record)

    @patch("sentry.analytics.record")
    def test_wildcard(self, mock_record):
        query = "abc:hello*"
        with self.feature({"organizations:advanced-search": False}), self.assertRaisesRegexp(
            ValidationError, ".*wildcard search.*"
        ):
            self.run_test(query)

        self.run_test(query)
        self.assert_analytics_recorded(mock_record)

        query = "raw * search"
        with self.feature({"organizations:advanced-search": False}), self.assertRaisesRegexp(
            ValidationError, ".*wildcard search.*"
        ):
            self.run_test(query)

        self.run_test(query)
        self.assert_analytics_recorded(mock_record)


class UpdateGroupsTest(TestCase):
    @patch("sentry.signals.issue_ignored.send_robust")
    def test_unresolving_resolved_group(self, send_robust):
        resolved_group = self.create_group(status=GroupStatus.RESOLVED)
        assert resolved_group.status == GroupStatus.RESOLVED

        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.data = {"status": "unresolved"}
        request.GET = QueryDict(query_string="id={}".format(resolved_group.id))

        search_fn = Mock()
        update_groups(request, [self.project], self.organization.id, search_fn)

        resolved_group.refresh_from_db()

        assert resolved_group.status == GroupStatus.UNRESOLVED
        assert not send_robust.called

    @patch("sentry.signals.issue_resolved.send_robust")
    def test_resolving_unresolved_group(self, send_robust):
        unresolved_group = self.create_group(status=GroupStatus.UNRESOLVED)
        assert unresolved_group.status == GroupStatus.UNRESOLVED

        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.data = {"status": "resolved"}
        request.GET = QueryDict(query_string="id={}".format(unresolved_group.id))

        search_fn = Mock()
        update_groups(request, [self.project], self.organization.id, search_fn)

        unresolved_group.refresh_from_db()

        assert unresolved_group.status == GroupStatus.RESOLVED
        assert send_robust.called

    @patch("sentry.signals.issue_ignored.send_robust")
    def test_ignoring_group(self, send_robust):
        group = self.create_group()

        request = self.make_request(user=self.user, method="GET")
        request.user = self.user
        request.data = {"status": "ignored"}
        request.GET = QueryDict(query_string="id={}".format(group.id))

        search_fn = Mock()
        update_groups(request, [self.project], self.organization.id, search_fn)

        group.refresh_from_db()

        assert group.status == GroupStatus.IGNORED
        assert send_robust.called
