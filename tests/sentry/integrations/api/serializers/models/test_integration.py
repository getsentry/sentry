from sentry.api.serializers import serialize
from sentry.integrations.utils.github_permissions import GITHUB_APP_REQUIRED_PERMISSIONS_OPTION
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class IntegrationSerializerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

    def test_other_provider_has_null_out_of_date(self) -> None:
        integration = self.create_provider_integration(
            provider="opsgenie",
            external_id="opsgenie:1",
            name="Team A",
            metadata={"permissions": {"contents": "read"}},
        )

        result = serialize(integration, self.user)

        assert result["outOfDate"] is None

    @override_options({GITHUB_APP_REQUIRED_PERMISSIONS_OPTION: {"contents": "write"}})
    def test_github_out_of_date_when_missing_permissions(self) -> None:
        integration = self.create_provider_integration(
            provider="github",
            external_id="1",
            name="octocat",
            metadata={"permissions": {"contents": "read"}},
        )

        result = serialize(integration, self.user)

        assert result["outOfDate"] is True

    @override_options({GITHUB_APP_REQUIRED_PERMISSIONS_OPTION: {"contents": "write"}})
    def test_github_not_out_of_date_when_permissions_satisfied(self) -> None:
        integration = self.create_provider_integration(
            provider="github",
            external_id="2",
            name="octocat",
            metadata={"permissions": {"contents": "write"}},
        )

        result = serialize(integration, self.user)

        assert result["outOfDate"] is False
