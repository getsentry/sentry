from unittest.mock import patch

import responses

from sentry import audit_log
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.organization import Organization
from sentry.tasks.auto_enable_codecov import enable_for_organization, schedule_organizations
from sentry.testutils import TestCase
from sentry.testutils.helpers import apply_feature_flag_on_cls


@apply_feature_flag_on_cls("organizations:auto-enable-codecov")
class AutoEnableCodecovTest(TestCase):
    def setUp(self):
        self.org_1 = self.create_organization()
        self.org_2 = self.create_organization()
        self.integration = self.create_integration(
            organization=self.org_1,
            provider="github",
            external_id="id",
        )

        responses.add(
            responses.GET,
            "https://api.codecov.io/api/v2/github/testgit",
            status=200,
        )

        responses.add(
            responses.GET,
            "https://api.codecov.io/api/v2/github/fakegit",
            status=404,
        )

    @responses.activate
    @patch(
        "sentry.integrations.github.GitHubAppsClient.get_repositories",
        return_value=[{"name": "abc", "full_name": "testgit/abc"}],
    )
    def test_has_codecov_integration(self, mock_get_repositories):
        AuditLogEntry.objects.all().delete()
        assert not self.org_1.flags.codecov_access.is_set
        enable_for_organization(self.org_1.id)

        assert mock_get_repositories.call_count == 1

        org = Organization.objects.get(id=self.org_1.id)
        assert org.flags.codecov_access

        audit = AuditLogEntry.objects.filter(
            organization_id=org.id, event=audit_log.get_event_id("ORG_EDIT")
        )
        assert audit.exists()

    @responses.activate
    @patch(
        "sentry.integrations.github.GitHubAppsClient.get_repositories",
        return_value={"repositories": [{"full_name": "fakegit/abc"}]},
    )
    def test_no_codecov_integration(self, mock_get_repositories):
        assert not self.org_1.flags.codecov_access.is_set
        enable_for_organization(self.org_1.id)

        assert mock_get_repositories.call_count == 1

        org = Organization.objects.get(id=self.org_1.id)
        assert not org.flags.codecov_access.is_set

    @patch("sentry.tasks.auto_enable_codecov.enable_for_organization")
    def test_schedules_for_orgs(self, mock_enable_for_organization):
        schedule_organizations()

        assert mock_enable_for_organization.call_count == 3
