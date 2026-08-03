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

    def test_missing_discover_feature_returns_forbidden(self) -> None:
        query = {
            "field": ["user"],
            "project": [self.project.id],
        }
        features = {
            "organizations:discover-basic": False,
            "organizations:performance-view": False,
            "organizations:visibility-explore-view": False,
        }

        response = self.do_request(query, features=features)

        assert response.status_code == 403
        assert response.data == {
            "detail": "Discover, Performance, or Explore is required to access this endpoint."
        }

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

    def _api_token_request(self, query, features):
        """Issue an external API-token request, which forces the referrer to
        `api.auth-token.events` (the "external API request" branch of the
        blocked-org warning)."""
        api_key = self.create_api_key(organization=self.organization, scope_list=["org:read"])
        features.update(self.features)
        url = self.reverse_url()
        with self.feature(features):
            return self.client_get(
                url,
                query,
                format="json",
                HTTP_AUTHORIZATION=self.create_basic_auth_header(api_key.key),
            )

    @mock.patch("sentry.api.endpoints.organization_events.sdk_logger")
    @mock.patch("sentry.snuba.discover.query")
    def test_blocked_org_log_fires_for_discover(
        self, mock_query: mock.MagicMock, mock_sdk_logger: mock.MagicMock
    ) -> None:
        mock_query.return_value = {}

        # discover is the default dataset when none is specified
        query = {"field": ["user"], "project": [self.project.id]}
        self._api_token_request(
            query,
            features={
                "organizations:discover-basic": True,
                "organizations:events-endpoint-transactions-discover-blocked": True,
            },
        )

        mock_sdk_logger.warning.assert_called_once()
        _, kwargs = mock_sdk_logger.warning.call_args
        assert kwargs["attributes"] == {
            "org_id": self.organization.id,
            "org_slug": self.organization.slug,
            # no dataset param was passed, so the requested value is empty
            "requested_dataset": "",
            # but the default dataset is used
            "effective_dataset": "discover",
            "endpoint_name": "organization-events",
        }

    @mock.patch("sentry.api.endpoints.organization_events.sdk_logger")
    @mock.patch("sentry.snuba.transactions.query")
    def test_blocked_org_log_fires_for_transactions(
        self, mock_query: mock.MagicMock, mock_sdk_logger: mock.MagicMock
    ) -> None:
        mock_query.return_value = {}

        query = {"field": ["user"], "project": [self.project.id], "dataset": "transactions"}
        self._api_token_request(
            query,
            features={
                "organizations:discover-basic": True,
                "organizations:events-endpoint-transactions-discover-blocked": True,
            },
        )

        mock_sdk_logger.warning.assert_called_once()
        _, kwargs = mock_sdk_logger.warning.call_args
        assert kwargs["attributes"]["effective_dataset"] == "transactions"
        assert kwargs["attributes"]["requested_dataset"] == "transactions"

    @mock.patch("sentry.api.endpoints.organization_events.sdk_logger")
    @mock.patch("sentry.snuba.discover.query")
    def test_blocked_org_log_not_fired_when_flag_off(
        self, mock_query: mock.MagicMock, mock_sdk_logger: mock.MagicMock
    ) -> None:
        mock_query.return_value = {}

        query = {"field": ["user"], "project": [self.project.id]}
        self._api_token_request(
            query,
            features={
                "organizations:discover-basic": True,
                "organizations:events-endpoint-transactions-discover-blocked": False,
            },
        )

        mock_sdk_logger.warning.assert_not_called()

    @mock.patch("sentry.api.endpoints.organization_events.sdk_logger")
    @mock.patch("sentry.snuba.discover.query")
    def test_blocked_org_log_not_fired_for_non_external_request(
        self, mock_query: mock.MagicMock, mock_sdk_logger: mock.MagicMock
    ) -> None:
        mock_query.return_value = {}

        query = {"field": ["user"], "project": [self.project.id]}
        # do_request uses a session login, not an API token
        self.do_request(
            query,
            features={
                "organizations:discover-basic": True,
                "organizations:events-endpoint-transactions-discover-blocked": True,
            },
        )

        mock_sdk_logger.warning.assert_not_called()

    @mock.patch("sentry.api.endpoints.organization_events.sdk_logger")
    @mock.patch("sentry.snuba.errors.query")
    def test_blocked_org_log_not_fired_for_non_legacy_dataset(
        self, mock_query: mock.MagicMock, mock_sdk_logger: mock.MagicMock
    ) -> None:
        mock_query.return_value = {}

        query = {"field": ["user"], "project": [self.project.id], "dataset": "errors"}
        self._api_token_request(
            query,
            features={
                "organizations:discover-basic": True,
                "organizations:events-endpoint-transactions-discover-blocked": True,
            },
        )

        mock_sdk_logger.warning.assert_not_called()
