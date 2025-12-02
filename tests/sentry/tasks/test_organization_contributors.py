from __future__ import annotations

from unittest.mock import patch

from sentry.models.organizationcontributors import OrganizationContributors
from sentry.silo.base import SiloMode
from sentry.tasks.organization_contributors import reset_num_actions_for_organization_contributors
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode


class ResetNumActionsForOrganizationContributorsTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_integration(
                organization=self.organization,
                external_id="github:1",
                provider="github",
            )

    @patch("sentry.tasks.organization_contributors.logger")
    def test_resets_num_actions_for_all_contributors(self, mock_logger):
        contributor1 = OrganizationContributors.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            external_identifier="user1",
            alias="User One",
            num_actions=5,
        )
        contributor2 = OrganizationContributors.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            external_identifier="user2",
            alias="User Two",
            num_actions=10,
        )
        contributor3 = OrganizationContributors.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            external_identifier="user3",
            alias="User Three",
            num_actions=1,
        )

        reset_num_actions_for_organization_contributors(self.organization.id)

        mock_logger.info.assert_called_once_with(
            "organization_contributors.reset_num_actions",
            extra={"organization_id": self.organization.id, "rows_updated": 3},
        )

        contributor1.refresh_from_db()
        contributor2.refresh_from_db()
        contributor3.refresh_from_db()

        assert contributor1.num_actions == 0
        assert contributor2.num_actions == 0
        assert contributor3.num_actions == 0

    def test_skips_contributors_already_at_zero(self):
        contributor_zero = OrganizationContributors.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            external_identifier="user_zero",
            alias="User Zero",
            num_actions=0,
        )
        contributor_nonzero = OrganizationContributors.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            external_identifier="user_nonzero",
            alias="User NonZero",
            num_actions=5,
        )

        original_date_updated = contributor_zero.date_updated

        reset_num_actions_for_organization_contributors(self.organization.id)

        contributor_zero.refresh_from_db()
        contributor_nonzero.refresh_from_db()

        assert contributor_zero.date_updated == original_date_updated
        assert contributor_zero.num_actions == 0

        assert contributor_nonzero.num_actions == 0
        assert contributor_nonzero.date_updated > original_date_updated

    def test_only_updates_specified_organization(self):
        other_organization = self.create_organization()

        contributor_in_org = OrganizationContributors.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            external_identifier="user_in_org",
            alias="User In Org",
            num_actions=5,
        )

        contributor_other_org = OrganizationContributors.objects.create(
            organization=other_organization,
            integration_id=self.integration.id,
            external_identifier="user_other_org",
            alias="User Other Org",
            num_actions=10,
        )

        reset_num_actions_for_organization_contributors(self.organization.id)

        contributor_in_org.refresh_from_db()
        contributor_other_org.refresh_from_db()

        assert contributor_in_org.num_actions == 0
        assert contributor_other_org.num_actions == 10
