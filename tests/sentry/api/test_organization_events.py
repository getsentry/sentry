from unittest import mock

from django.urls import reverse

from sentry.testutils.cases import APITestCase, PerformanceIssueTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test

MAX_QUERYABLE_TRANSACTION_THRESHOLDS = 1


class OrganizationEventsEndpointTestBase(APITestCase, SnubaTestCase):
    viewname = "sentry-api-0-organization-events"
    referrer = "api.organization-events"

    def setUp(self):
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)
        self.ten_mins_ago_iso = iso_format(self.ten_mins_ago)
        self.features = {}

    def client_get(self, *args, **kwargs):
        return self.client.get(*args, **kwargs)

    def reverse_url(self):
        return reverse(
            self.viewname,
            kwargs={"organization_slug": self.organization.slug},
        )


@region_silo_test(stable=True)
class OrganizationEventsEndpointTest(OrganizationEventsEndpointTestBase, PerformanceIssueTestCase):
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
