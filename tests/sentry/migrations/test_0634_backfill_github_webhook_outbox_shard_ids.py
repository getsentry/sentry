import pytest
from django.test import RequestFactory

from sentry.models.outbox import ControlOutbox, WebhookProviderIdentifier
from sentry.testutils.cases import TestMigrations
from sentry.testutils.silo import no_silo_test


@pytest.mark.skip("Migration is no longer runnable. Retain until migration is removed.")
@no_silo_test
class TestBackfillGithubWebhookOutboxShardIds(TestMigrations):
    migrate_from = "0633_add_priority_locked_at_to_groupedmessage"
    migrate_to = "0634_backfill_github_webhook_outbox_shard_ids"
    connection = "control"

    def setup_before_migration(self, apps):
        # Set custom IDs for the integrations, as the defaults can conflict with
        # the existing github IDs
        self.first_integration = self.create_integration(
            id=42,
            organization=self.create_organization(owner=self.create_user()),
            external_id="github:1",
            provider="github",
        )
        self.second_integration = self.create_integration(
            id=43,
            organization=self.create_organization(owner=self.create_user()),
            external_id="github:2",
            provider="github",
        )

        request_factory = RequestFactory()

        self.valid_outboxes_first_integration = list(
            ControlOutbox.for_webhook_update(
                shard_identifier=WebhookProviderIdentifier.GITHUB.value,
                region_names=["us", "de"],
                request=request_factory.post(
                    path="/extensions/github/path",
                    data={"installation": {"id": "github:1"}},
                    content_type="application/json",
                ),
            ),
        )

        for outbox in self.valid_outboxes_first_integration:
            outbox.save()

        self.valid_outboxes_second_integration = list(
            ControlOutbox.for_webhook_update(
                shard_identifier=WebhookProviderIdentifier.GITHUB.value,
                region_names=["de"],
                request=request_factory.post(
                    path="/extensions/github/path",
                    data={"installation": {"id": "github:2"}},
                    content_type="application/json",
                ),
            ),
        )

        for outbox in self.valid_outboxes_second_integration:
            outbox.save()

        self.outboxes_missing_integration = list(
            ControlOutbox.for_webhook_update(
                shard_identifier=WebhookProviderIdentifier.GITHUB.value,
                region_names=["us"],
                request=request_factory.post(
                    path="/extensions/github/path",
                    data={"installation": {"id": "github:3"}},
                    content_type="application/json",
                ),
            )
        )

        self.outboxes_missing_integration.extend(
            ControlOutbox.for_webhook_update(
                shard_identifier=WebhookProviderIdentifier.SLACK.value,
                region_names=["us"],
                request=request_factory.post(
                    path="/extensions/github/path",
                    data={"installation": {"id": "github:3"}},
                    content_type="application/json",
                ),
            )
        )

        self.outboxes_missing_integration.extend(
            ControlOutbox.for_webhook_update(
                shard_identifier=WebhookProviderIdentifier.SLACK.value,
                region_names=["us"],
                request=request_factory.post(
                    path="/extensions/github/path",
                    data={},
                    content_type="application/json",
                ),
            )
        )

        for outbox in self.outboxes_missing_integration:
            outbox.save()

        self.outboxes_with_invalid_content_type = list(
            ControlOutbox.for_webhook_update(
                shard_identifier=WebhookProviderIdentifier.GITHUB,
                region_names=["us"],
                request=request_factory.post(
                    path="/extensions/github/path",
                    data={"installation": {"id": "github:1"}},
                    content_type="invalid",
                ),
            )
        )
        for outbox in self.outboxes_with_invalid_content_type:
            outbox.save()

    def test_updates_only_valid_outboxes_with_integration_id(self):
        for outbox in self.valid_outboxes_first_integration:
            updated_outbox = ControlOutbox.objects.get(id=outbox.id)
            assert updated_outbox.shard_identifier == self.first_integration.id
            assert updated_outbox.shard_identifier != outbox.shard_identifier

        for outbox in self.valid_outboxes_second_integration:
            updated_outbox = ControlOutbox.objects.get(id=outbox.id)
            assert updated_outbox.shard_identifier == self.second_integration.id
            assert updated_outbox.shard_identifier != outbox.shard_identifier

        for outbox in self.outboxes_with_invalid_content_type:
            updated_outbox = ControlOutbox.objects.get(id=outbox.id)
            assert updated_outbox.shard_identifier == outbox.shard_identifier

        for outbox in self.outboxes_missing_integration:
            updated_outbox = ControlOutbox.objects.get(id=outbox.id)
            assert updated_outbox.shard_identifier == outbox.shard_identifier
