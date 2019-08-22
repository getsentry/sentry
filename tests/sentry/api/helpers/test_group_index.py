from __future__ import absolute_import

from mock import patch

from sentry.api.helpers.group_index import validate_search_filter_permissions, ValidationError
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
