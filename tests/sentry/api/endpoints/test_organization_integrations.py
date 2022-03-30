from unittest import TestCase

from sentry.api.endpoints.organization_integrations import query_param_to_bool
from sentry.models import Integration
from sentry.testutils import APITestCase


class QueryParamToBoolTest(TestCase):
    def test_empty(self):
        assert not query_param_to_bool(None)
        assert not query_param_to_bool("")

    def test_int(self):
        assert query_param_to_bool(1)
        assert query_param_to_bool("1")

        assert not query_param_to_bool(0)
        assert not query_param_to_bool(-1)
        assert not query_param_to_bool("0")
        assert not query_param_to_bool("-1")

    def test_bool(self):
        assert query_param_to_bool(True)
        assert query_param_to_bool("true")
        assert query_param_to_bool("True")

        assert not query_param_to_bool(False)
        assert not query_param_to_bool("False")


class OrganizationIntegrationsListTest(APITestCase):
    endpoint = "sentry-api-0-organization-integrations"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.integration = Integration.objects.create(provider="example", name="Example")
        self.integration.add_organization(self.organization, self.user)

    def test_simple(self):
        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.integration.id)
        assert "configOrganization" in response.data[0]

    def test_no_config(self):
        response = self.get_success_response(self.organization.slug, qs_params={"includeConfig": 0})

        assert "configOrganization" not in response.data[0]
