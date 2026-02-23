from unittest import mock

from django.urls import reverse

from sentry.search.events import constants
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.snuba import QueryExecutionError, QueryIllegalTypeOfArgument, RateLimitExceeded

MAX_QUERYABLE_TRANSACTION_THRESHOLDS = 1


class OrganizationEventsEndpointTest(APITestCase):
    viewname = "sentry-api-0-organization-events"
    referrer = "api.organization-events"

    def setUp(self) -> None:
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)
        self.ten_mins_ago_iso = self.ten_mins_ago.isoformat()
        self.features: dict[str, bool] = {}

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

    def test_api_key_request(self) -> None:
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
        query = {
            "field": ["project.name", "environment"],
            "project": [self.project.id],
            "statsPeriod": "1h",
            "query": "environment:staging",
        }

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

    @mock.patch("sentry.snuba.discover.query")
    def test_api_token_referrer(self, mock: mock.MagicMock) -> None:
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
    def test_invalid_referrer(self, mock: mock.MagicMock) -> None:
        mock.return_value = {}

        query = {
            "field": ["user"],
            "referrer": "api.insights.invalid",
            "project": [self.project.id],
        }
        self.do_request(query)
        _, kwargs = mock.call_args
        self.assertEqual(kwargs["referrer"], self.referrer)

    @mock.patch("sentry.snuba.discover.query")
    def test_empty_referrer(self, mock: mock.MagicMock) -> None:
        mock.return_value = {}

        query = {
            "field": ["user"],
            "project": [self.project.id],
        }
        self.do_request(query)
        _, kwargs = mock.call_args
        self.assertEqual(kwargs["referrer"], self.referrer)

    @mock.patch("sentry.search.events.builder.base.raw_snql_query")
    def test_handling_snuba_errors(self, mock_snql_query: mock.MagicMock) -> None:
        self.create_project()

        mock_snql_query.side_effect = RateLimitExceeded("test")

        query = {"field": ["id", "timestamp"], "orderby": ["-timestamp", "-id"]}
        response = self.do_request(query)
        assert response.status_code == 429, response.content
        assert response.data["detail"] == constants.RATE_LIMIT_ERROR_MESSAGE

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
    def test_valid_referrer(self, mock: mock.MagicMock) -> None:
        mock.return_value = {}

        query = {
            "field": ["user"],
            "referrer": "api.insights.transaction-summary",
            "project": [self.project.id],
        }
        self.do_request(query)
        _, kwargs = mock.call_args
        self.assertEqual(kwargs["referrer"], "api.insights.transaction-summary")
