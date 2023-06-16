from unittest.mock import MagicMock

from sentry.models import Integration, ProjectCodeOwners
from sentry.tasks.codeowners import update_code_owners_schema
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class UpdateCodeOwnersSchemaTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.project_codeowner = self.create_codeowners(project=self.project)
        self.integration = Integration.objects.get()

        self.mock_update = MagicMock()
        ProjectCodeOwners.update_schema = self.mock_update

    def test_no_op(self):
        with self.feature("organizations:integrations-codeowners"):
            update_code_owners_schema(self.organization)
        self.mock_update.assert_not_called()

    def test_with_project(self):
        with self.feature("organizations:integrations-codeowners"):
            update_code_owners_schema(self.organization, projects=[self.project])
        self.mock_update.assert_called_with(organization=self.organization)

    def test_with_project_id(self):
        with self.feature("organizations:integrations-codeowners"):
            update_code_owners_schema(self.organization, projects=[self.project.id])
        self.mock_update.assert_called_with(organization=self.organization)

    def test_with_integration(self):
        with self.feature("organizations:integrations-codeowners"):
            update_code_owners_schema(self.organization, integration=self.integration)
        self.mock_update.assert_called_with(organization=self.organization)

    def test_with_integration_id(self):
        with self.feature("organizations:integrations-codeowners"):
            update_code_owners_schema(self.organization, integration=self.integration.id)
        self.mock_update.assert_called_with(organization=self.organization)
