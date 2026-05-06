from typing import Any

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.receivers.outbox.cell import backfill_scm_integration_config
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode


class BackfillScmIntegrationConfigReceiverTest(TestCase):
    def _create_oi(
        self,
        provider: str,
        external_id: str,
        config: dict[str, Any] | None = None,
        status: int = ObjectStatus.ACTIVE,
    ) -> OrganizationIntegration:
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = Integration.objects.create(
                provider=provider,
                external_id=external_id,
                name=f"{provider}-{external_id}",
            )
            return OrganizationIntegration.objects.create(
                organization_id=self.organization.id,
                integration_id=integration.id,
                status=status,
                config=config or {},
            )

    def _read_config(self, oi: OrganizationIntegration) -> dict[str, Any]:
        with assume_test_silo_mode(SiloMode.CONTROL):
            return OrganizationIntegration.objects.get(id=oi.id).config

    def test_backfills_github_keys(self) -> None:
        oi = self._create_oi(provider="github", external_id="gh")

        backfill_scm_integration_config(
            shard_identifier=self.organization.id,
            payload={"keys": ["sentry:github_pr_bot", "sentry:github_nudge_invite"]},
        )

        assert self._read_config(oi) == {"pr_comments": True, "nudge_invite": True}

    def test_backfills_gitlab_key(self) -> None:
        oi = self._create_oi(provider="gitlab", external_id="gl")

        backfill_scm_integration_config(
            shard_identifier=self.organization.id,
            payload={"keys": ["sentry:gitlab_pr_bot"]},
        )

        assert self._read_config(oi) == {"pr_comments": True}

    def test_preserves_existing_config_keys(self) -> None:
        oi = self._create_oi(
            provider="github",
            external_id="gh",
            config={"pr_comments": False, "other": "kept"},
        )

        backfill_scm_integration_config(
            shard_identifier=self.organization.id,
            payload={"keys": ["sentry:github_pr_bot", "sentry:github_nudge_invite"]},
        )

        config = self._read_config(oi)
        assert config["pr_comments"] is False
        assert config["nudge_invite"] is True
        assert config["other"] == "kept"

    def test_skips_provider_with_no_matching_keys(self) -> None:
        gl = self._create_oi(provider="gitlab", external_id="gl")

        backfill_scm_integration_config(
            shard_identifier=self.organization.id,
            payload={"keys": ["sentry:github_pr_bot"]},
        )

        assert self._read_config(gl) == {}

    def test_skips_disabled_oi(self) -> None:
        oi = self._create_oi(provider="github", external_id="gh", status=ObjectStatus.DISABLED)

        backfill_scm_integration_config(
            shard_identifier=self.organization.id,
            payload={"keys": ["sentry:github_pr_bot"]},
        )

        assert self._read_config(oi) == {}

    def test_updates_multiple_active_ois_of_same_provider(self) -> None:
        gh1 = self._create_oi(provider="github", external_id="gh-1")
        gh2 = self._create_oi(provider="github", external_id="gh-2")

        backfill_scm_integration_config(
            shard_identifier=self.organization.id,
            payload={"keys": ["sentry:github_pr_bot"]},
        )

        assert self._read_config(gh1) == {"pr_comments": True}
        assert self._read_config(gh2) == {"pr_comments": True}

    def test_empty_payload_is_noop(self) -> None:
        oi = self._create_oi(provider="github", external_id="gh")

        backfill_scm_integration_config(shard_identifier=self.organization.id, payload={})

        assert self._read_config(oi) == {}

    def test_no_active_oi_for_provider_is_noop(self) -> None:
        # No OI created for the org.
        backfill_scm_integration_config(
            shard_identifier=self.organization.id,
            payload={"keys": ["sentry:github_pr_bot"]},
        )
