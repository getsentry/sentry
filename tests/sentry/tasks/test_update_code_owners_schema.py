from unittest import mock

import pytest

from sentry.models.integrations.integration import Integration
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.silo import SiloMode
from sentry.tasks.codeowners import update_code_owners_schema
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
class UpdateCodeOwnersSchemaTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.project_codeowner = self.create_codeowners(project=self.project)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = Integration.objects.get()

    @pytest.fixture(autouse=True)
    def patch_update_schema(self):
        with mock.patch.object(ProjectCodeOwners, "update_schema") as self.mock_update:
            yield

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
