import pytest

from sentry.integrations.services.integration.serial import serialize_integration
from sentry.integrations.utils.hostname import instance_hostname
from sentry.testutils.cases import TestCase


class InstanceHostnameTest(TestCase):
    def test_supported_providers(self) -> None:
        cases = [
            ("github", {"domain_name": "github.com/example"}, "github.com"),
            (
                "github_enterprise",
                {"domain_name": "github.example.com/example"},
                "github.example.com",
            ),
            ("gitlab", {"instance": "gitlab.example.com"}, "gitlab.example.com"),
        ]
        for provider, metadata, expected in cases:
            with self.subTest(provider=provider):
                integration = self.create_integration(
                    organization=self.organization,
                    provider=provider,
                    external_id=f"{provider}:1",
                    metadata=metadata,
                )
                assert instance_hostname(integration) == expected
                assert instance_hostname(serialize_integration(integration)) == expected

    def test_unsupported_provider(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="slack",
            external_id="slack:1",
        )
        with pytest.raises(NotImplementedError):
            instance_hostname(integration)
