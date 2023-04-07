import pytest

from sentry.models import (
    OrganizationIntegration,
    PagerDutyService,
    Repository,
    RepositoryProjectPathConfig,
)
from sentry.testutils.cases import TestMigrations

pytestmark = pytest.mark.sentry_metrics


class BackfillPerfSubscriptionsTest(TestMigrations):
    migrate_from = "0415_backfill_actor_team_and_user"
    migrate_to = "0416_backfill_groupedmessage_substatus"

    def setup_initial_state(self):
        org = self.create_organization()
        self.create_integration(org, "blah")
        project = self.create_project(organization=org)
        oi = OrganizationIntegration.objects.last()

        PagerDutyService.objects.create(
            organization_integration=oi, integration_key="asf", service_name="house"
        )
        repo = Repository.objects.create(organization_id=org.id, name="moo")
        RepositoryProjectPathConfig.objects.create(
            organization_integration=oi,
            repository=repo,
            project=project,
            stack_root="asdf",
            source_root="src",
        )

    def test(self):
        assert PagerDutyService.objects.count() == 1
        assert RepositoryProjectPathConfig.objects.count() == 1

        for pds in PagerDutyService.objects.all():
            assert pds.organization_id == pds.organization_integration.organization_id
            assert pds.integration_id == pds.organization_integration.integration_id
