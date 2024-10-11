from unittest import mock

from django.http import HttpRequest
from django.test import override_settings
from django.urls import reverse
from rest_framework.exceptions import ErrorDetail
from rest_framework.request import Request

from sentry.api.endpoints.organization_events import (
    DEFAULT_INCREASED_RATE_LIMIT,
    DEFAULT_REDUCED_RATE_LIMIT,
    LEGACY_RATE_LIMIT,
    rate_limit_events,
)
from sentry.search.events import constants
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import Feature, override_options, with_feature
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.snuba import QueryExecutionError, QueryIllegalTypeOfArgument, RateLimitExceeded

MAX_QUERYABLE_TRANSACTION_THRESHOLDS = 1


class OrganizationEventsEndpointTest(APITestCase):
    viewname = "sentry-api-0-organization-events"
    referrer = "api.organization-events"

    def setUp(self):
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)
        self.ten_mins_ago_iso = self.ten_mins_ago.isoformat()
        self.features = {}

    def client_get(self, *args, **kwargs):
        return self.client.get(*args, **kwargs)

    def reverse_url(self):
        return reverse(
            self.viewname,
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def do_request(self, query, features=None, **kwargs):
        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        self.login_as(user=self.user)
        with self.feature(features):
            return self.client_get(self.reverse_url(), query, format="json", **kwargs)

    def test_api_key_request(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )

        # Project ID cannot be inferred when using an org API key, so that must
        # be passed in the parameters
        api_key = self.create_api_key(organization=self.organization, scope_list=["org:read"])
        query = {"field": ["project.name", "environment"], "project": [self.project.id]}

        url = self.reverse_url()
        response = self.client_get(
            url,
            query,
            format="json",
            HTTP_AUTHORIZATION=self.create_basic_auth_header(api_key.key),
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["project.name"] == self.project.slug

    def test_multiple_projects_open_membership(self):
        assert bool(self.organization.flags.allow_joinleave)
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=self.project.id,
        )
        project2 = self.create_project()
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.ten_mins_ago_iso,
            },
            project_id=project2.id,
        )
        response = self.do_request(
            {"field": ["project"], "project": -1, "referrer": "api.issues.issue_events"}
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2

        # The test will now not work since the membership is closed
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        assert bool(self.organization.flags.allow_joinleave) is False
        response = self.do_request(
            {"field": ["project"], "project": -1, "referrer": "api.issues.issue_events"}
        )

        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": ErrorDetail(
                string="You cannot view events from multiple projects.", code="parse_error"
            )
        }

    @mock.patch("sentry.snuba.discover.query")
    def test_api_token_referrer(self, mock):
        mock.return_value = {}
        # Project ID cannot be inferred when using an org API key, so that must
        # be passed in the parameters
        api_key = self.create_api_key(organization=self.organization, scope_list=["org:read"])

        query = {
            "field": ["project.name", "environment"],
            "project": [self.project.id],
        }

        features = {"organizations:discover-basic": True}
        features.update(self.features)
        url = self.reverse_url()

        with self.feature(features):
            self.client_get(
                url,
                query,
                format="json",
                HTTP_AUTHORIZATION=self.create_basic_auth_header(api_key.key),
            )

        _, kwargs = mock.call_args
        self.assertEqual(kwargs["referrer"], "api.auth-token.events")

    @mock.patch("sentry.snuba.discover.query")
    def test_invalid_referrer(self, mock):
        mock.return_value = {}

        query = {
            "field": ["user"],
            "referrer": "api.performance.invalid",
            "project": [self.project.id],
        }
        self.do_request(query)
        _, kwargs = mock.call_args
        self.assertEqual(kwargs["referrer"], self.referrer)

    @mock.patch("sentry.snuba.discover.query")
    def test_empty_referrer(self, mock):
        mock.return_value = {}

        query = {
            "field": ["user"],
            "project": [self.project.id],
        }
        self.do_request(query)
        _, kwargs = mock.call_args
        self.assertEqual(kwargs["referrer"], self.referrer)

    @mock.patch("sentry.search.events.builder.base.raw_snql_query")
    def test_handling_snuba_errors(self, mock_snql_query):
        self.create_project()

        mock_snql_query.side_effect = RateLimitExceeded("test")

        query = {"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]}
        response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert response.data["detail"] == constants.TIMEOUT_ERROR_MESSAGE

        mock_snql_query.side_effect = QueryExecutionError("test")

        query = {"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]}
        response = self.do_request(query)
        assert response.status_code == 500, response.content
        assert response.data["detail"] == "Internal error. Your query failed to run."

        mock_snql_query.side_effect = QueryIllegalTypeOfArgument("test")

        query = {"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]}
        response = self.do_request(query)

        assert response.status_code == 400, response.content
        assert response.data["detail"] == "Invalid query. Argument to function is wrong type."

    @mock.patch("sentry.snuba.discover.query")
    def test_valid_referrer(self, mock):
        mock.return_value = {}

        query = {
            "field": ["user"],
            "referrer": "api.performance.transaction-summary",
            "project": [self.project.id],
        }
        self.do_request(query)
        _, kwargs = mock.call_args
        self.assertEqual(kwargs["referrer"], "api.performance.transaction-summary")

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_ratelimit(self):
        query = {
            "field": ["transaction"],
            "project": [self.project.id],
        }
        limit = LEGACY_RATE_LIMIT
        with freeze_time("2000-01-01") as frozen_time:
            for _ in range(
                limit["limit"] - 1
            ):  # for longer windows / higher limits this loop takes too long
                self.do_request(query)
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            response = self.do_request(query)
            assert response.status_code == 429, response.content
            frozen_time.shift(limit["window"] + 1)
            response = self.do_request(query)
            assert response.status_code == 200, response.content

    def test_rate_limit_events_without_rollout(self):
        slug = self.organization.slug
        request = Request(HttpRequest())

        assert rate_limit_events(request, slug)["GET"][RateLimitCategory.IP] == RateLimit(
            **LEGACY_RATE_LIMIT
        )

    @with_feature("organizations:api-organization_events-rate-limit-reduced-rollout")
    def test_rate_limit_events_with_rollout(self):
        slug = self.organization.slug
        request = Request(HttpRequest())

        assert rate_limit_events(request, slug)["GET"][RateLimitCategory.IP] == RateLimit(
            **DEFAULT_REDUCED_RATE_LIMIT
        )

        with override_options(
            {
                "api.organization_events.rate-limit-reduced.limits": {
                    "limit": 123,
                    "window": 456,
                },
            },
        ):
            assert rate_limit_events(request, slug)["GET"][RateLimitCategory.IP] == RateLimit(
                limit=123,
                window=456,
            )

    def test_rate_limit_events_increased(self):
        slug = self.organization.slug
        request = Request(HttpRequest())

        with override_options(
            {"api.organization_events.rate-limit-increased.orgs": [self.organization.id]}
        ):
            assert rate_limit_events(request, slug)["GET"][RateLimitCategory.IP] == RateLimit(
                **DEFAULT_INCREASED_RATE_LIMIT
            )

        # when both reduced rollout and increased rate limit for org, increased rate limit should take precedence
        with (
            Feature("organizations:api-organization_events-rate-limit-reduced-rollout"),
            override_options(
                {"api.organization_events.rate-limit-increased.orgs": [self.organization.id]}
            ),
        ):
            assert rate_limit_events(request, slug)["GET"][RateLimitCategory.IP] == RateLimit(
                **DEFAULT_INCREASED_RATE_LIMIT
            )

        with override_options(
            {
                "api.organization_events.rate-limit-increased.orgs": [self.organization.id],
                "api.organization_events.rate-limit-increased.limits": {
                    "limit": 123,
                    "window": 456,
                },
            },
        ):
            assert rate_limit_events(request, slug)["GET"][RateLimitCategory.IP] == RateLimit(
                limit=123,
                window=456,
            )

    def test_rate_limit_events_invalid_options(self):
        slug = self.organization.slug
        request = Request(HttpRequest())

        with override_options(
            {
                "api.organization_events.rate-limit-increased.orgs": [self.organization.id],
                "api.organization_events.rate-limit-increased.limits": {
                    "limit": "invalid",
                    "window": 123,
                },
            },
        ):
            assert rate_limit_events(request, slug)["GET"][RateLimitCategory.IP] == RateLimit(
                **DEFAULT_INCREASED_RATE_LIMIT
            )

        with override_options(
            {
                "api.organization_events.rate-limit-increased.orgs": [self.organization.id],
                "api.organization_events.rate-limit-increased.limits": {
                    "leemeet": 123,
                    "window": 123,
                },
            },
        ):
            assert rate_limit_events(request, slug)["GET"][RateLimitCategory.IP] == RateLimit(
                **DEFAULT_INCREASED_RATE_LIMIT
            )

        with (
            Feature("organizations:api-organization_events-rate-limit-reduced-rollout"),
            override_options(
                {
                    "api.organization_events.rate-limit-reduced.limits": {
                        "limit": 123,
                        "window": 456,
                        "concurrent_limit": 789,
                        "unexpected_key": 0xBAD,
                    },
                }
            ),
        ):
            assert rate_limit_events(request, slug)["GET"][RateLimitCategory.IP] == RateLimit(
                **DEFAULT_REDUCED_RATE_LIMIT
            )

    def test_rate_limit_events_bad_slug(self):
        slug = "ucsc-banana-slugs-go-sammy"
        request = Request(HttpRequest())

        assert rate_limit_events(request, slug)["GET"][RateLimitCategory.IP] == RateLimit(
            **LEGACY_RATE_LIMIT
        )
