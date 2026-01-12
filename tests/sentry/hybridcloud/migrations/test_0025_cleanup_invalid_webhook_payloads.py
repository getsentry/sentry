from django.utils import timezone

from sentry.hybridcloud.models.webhookpayload import DestinationType
from sentry.testutils.cases import TestMigrations


class CleanupInvalidWebhookPayloadsTest(TestMigrations):
    migrate_from = "0024_add_project_distribution_scope"
    migrate_to = "0025_cleanup_invalid_webhook_payloads"
    app = "hybridcloud"

    def setup_initial_state(self) -> None:
        # Create a valid webhook payload (destination_type='sentry_region' with region_name)
        self.valid_webhook = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )

        # Create an invalid webhook payload using raw SQL
        # (destination_type='sentry_region' but region_name=NULL, which violates the CHECK constraint)
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO hybridcloud_webhookpayload
                (mailbox_name, provider, destination_type, region_name, request_method,
                 request_path, request_headers, request_body, schedule_for, attempts, date_added)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                [
                    "github:456",
                    "github",
                    "sentry_region",
                    None,  # This violates the CHECK constraint
                    "POST",
                    "/webhook/",
                    "{}",
                    "{}",
                    timezone.now(),
                    0,
                    timezone.now(),
                ],
            )
            self.invalid_webhook_id = cursor.fetchone()[0]

        # Create a webhook with CODECOV destination (region_name can be NULL)
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO hybridcloud_webhookpayload
                (mailbox_name, provider, destination_type, region_name, request_method,
                 request_path, request_headers, request_body, schedule_for, attempts, date_added)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                [
                    "github:codecov:789",
                    "github",
                    DestinationType.CODECOV,
                    None,  # This is valid for CODECOV destination
                    "POST",
                    "/webhook/",
                    "{}",
                    "{}",
                    timezone.now(),
                    0,
                    timezone.now(),
                ],
            )
            self.codecov_webhook_id = cursor.fetchone()[0]

        # Verify all three records exist before migration
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM hybridcloud_webhookpayload")
            count = cursor.fetchone()[0]
            assert count == 3

    def test(self) -> None:
        from sentry.hybridcloud.models.webhookpayload import WebhookPayload

        # After migration, the invalid webhook should be deleted
        assert not WebhookPayload.objects.filter(id=self.invalid_webhook_id).exists()

        # Valid webhook should still exist
        assert WebhookPayload.objects.filter(id=self.valid_webhook.id).exists()

        # CODECOV webhook should still exist (region_name=NULL is valid for CODECOV)
        assert WebhookPayload.objects.filter(id=self.codecov_webhook_id).exists()

        # Should have exactly 2 records remaining
        assert WebhookPayload.objects.count() == 2
