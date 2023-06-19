import pytest

from sentry.models.integrations.external_issue import ExternalIssue
from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("Migration is no longer runnable. Retain until migration is removed.")
class FixBrokenExternalIssues(TestMigrations):
    migrate_from = "0428_backfill_denormalize_notification_actor"
    migrate_to = "0429_fix_broken_external_issues"

    def setup_initial_state(self):
        self.valid_external_issue = ExternalIssue.objects.create(
            organization_id=5417824, integration_id=1
        )
        self.broken_external_issue = ExternalIssue.objects.create(
            id=636683, organization_id=443715, integration_id=2
        )

    def test(self):
        self.broken_external_issue.refresh_from_db()
        self.valid_external_issue.refresh_from_db()
        assert self.broken_external_issue.organization_id == 5417824
        assert self.valid_external_issue.organization_id == 5417824
