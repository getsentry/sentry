from unittest import mock

from sentry.api.serializers import serialize
from sentry.integrations.api.serializers.models import integration as integration_serializer
from sentry.integrations.utils.github_permissions import GITHUB_APP_REQUIRED_PERMISSIONS_OPTION
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

FRESH_REFRESH_AT = "2026-08-01T00:00:00"
STALE_REFRESH_AT = "2026-07-01T00:00:00"


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
            metadata={
                "permissions": {"contents": "read"},
                "last_refresh_at": FRESH_REFRESH_AT,
            },
        )

        result = serialize(integration, self.user)

        assert result["outOfDate"] is True

    @override_options({GITHUB_APP_REQUIRED_PERMISSIONS_OPTION: {"contents": "write"}})
    def test_github_not_out_of_date_when_permissions_satisfied(self) -> None:
        integration = self.create_provider_integration(
            provider="github",
            external_id="2",
            name="octocat",
            metadata={
                "permissions": {"contents": "write"},
                "last_refresh_at": FRESH_REFRESH_AT,
            },
        )

        result = serialize(integration, self.user)

        assert result["outOfDate"] is False

    @override_options({GITHUB_APP_REQUIRED_PERMISSIONS_OPTION: {"contents": "write"}})
    def test_github_warns_when_out_of_date_is_a_guess(self) -> None:
        """A snapshot from before the app changed still shows the banner.

        It was read against the old required set, so it may be naming a
        permission this install was never asked for. The warning is how we find
        out how often that happens before changing what users see.
        """
        integration = self.create_provider_integration(
            provider="github",
            external_id="3",
            name="octocat",
            metadata={
                "permissions": {"contents": "read"},
                "last_refresh_at": STALE_REFRESH_AT,
            },
        )

        with mock.patch.object(integration_serializer.logger, "warning") as mock_warning:
            result = serialize(integration, self.user)

        assert result["outOfDate"] is True
        assert mock_warning.call_args.args[0] == "github_permissions.stale_snapshot"

    @override_options({GITHUB_APP_REQUIRED_PERMISSIONS_OPTION: {"contents": "write"}})
    def test_github_warns_without_a_refresh_timestamp(self) -> None:
        integration = self.create_provider_integration(
            provider="github",
            external_id="4",
            name="octocat",
            metadata={"permissions": {"contents": "read"}},
        )

        with mock.patch.object(integration_serializer.logger, "warning") as mock_warning:
            result = serialize(integration, self.user)

        assert result["outOfDate"] is True
        assert mock_warning.call_args.args[0] == "github_permissions.stale_snapshot"

    @override_options({GITHUB_APP_REQUIRED_PERMISSIONS_OPTION: {"contents": "write"}})
    def test_github_does_not_warn_when_a_stale_snapshot_looks_complete(self) -> None:
        """Nothing to guess about: we are not telling the user anything."""
        integration = self.create_provider_integration(
            provider="github",
            external_id="5",
            name="octocat",
            metadata={
                "permissions": {"contents": "write"},
                "last_refresh_at": STALE_REFRESH_AT,
            },
        )

        with mock.patch.object(integration_serializer.logger, "warning") as mock_warning:
            result = serialize(integration, self.user)

        assert result["outOfDate"] is False
        assert not mock_warning.called
