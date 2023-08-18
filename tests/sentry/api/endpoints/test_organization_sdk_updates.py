from unittest import mock

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class OrganizationMetricsPermissionTest(APITestCase):
    endpoint = "sentry-api-0-organization-sdks"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @mock.patch("sentry.api.endpoints.organization_sdk_updates.get_sdk_index", return_value={})
    def test_sdks_empty(self, mocked_sdk_index):
        response = self.get_success_response(self.organization.slug)

        assert mocked_sdk_index.call_count == 1
        assert response.data == {}

    @mock.patch(
        "sentry.api.endpoints.organization_sdk_updates.get_sdk_index",
        return_value={
            "sentry.cocoa": {
                "canonical": "cocoapods:sentry-cocoa",
                "main_docs_url": "https://docs.sentry.io/platforms/cocoa/",
                "name": "Sentry Cocoa",
                "repo_url": "https://github.com/getsentry/sentry-cocoa",
                "version": "8.10.0",
            }
        },
    )
    def test_sdks_contains_sdk(self, mocked_sdk_index):
        response = self.get_success_response(self.organization.slug)

        assert mocked_sdk_index.call_count == 1
        assert response.data["sentry.cocoa"]

    @mock.patch(
        "sentry.api.endpoints.organization_sdk_updates.get_sdk_index",
        side_effect=Exception("Something went wrong"),
    )
    def test_sdks_error(self, mocked_sdk_index):
        response = self.get_success_response(self.organization.slug)

        assert mocked_sdk_index.call_count == 1
        assert response.data == {}
