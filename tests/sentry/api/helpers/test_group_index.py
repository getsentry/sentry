from __future__ import absolute_import

from sentry.api.helpers.group_index import (
    validate_search_filter_permissions,
    ValidationError,
)
from sentry.api.issue_search import parse_search_query
from sentry.testutils import TestCase


class ValidateSearchFilterPermissionsTest(TestCase):

    def run_test(self, query):
        validate_search_filter_permissions(self.organization, parse_search_query(query))

    def test_negative(self):
        query = '!has:user'
        with self.feature(
                {'organizations:advanced-search': False},
        ), self.assertRaisesRegexp(ValidationError, '.*negative search.*'):
            self.run_test(query)

        self.run_test(query)

        query = '!something:123'
        with self.feature(
                {'organizations:advanced-search': False},
        ), self.assertRaisesRegexp(ValidationError, '.*negative search.*'):
            self.run_test(query)

        self.run_test(query)

    def test_wildcard(self):
        query = 'abc:hello*'
        with self.feature(
                {'organizations:advanced-search': False},
        ), self.assertRaisesRegexp(ValidationError, '.*wildcard search.*'):
            self.run_test(query)

        self.run_test(query)

        query = 'raw * search'
        with self.feature(
                {'organizations:advanced-search': False},
        ), self.assertRaisesRegexp(ValidationError, '.*wildcard search.*'):
            self.run_test(query)

        self.run_test(query)
