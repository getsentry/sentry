from collections.abc import Generator
from unittest import mock

import pytest

from sentry.integrations.models.integration import Integration
from sentry.models.organization import OrganizationStatus
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.silo.base import SiloMode
from sentry.tasks.codeowners import update_code_owners_schema
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode


class UpdateCodeOwnersSchemaTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.project_codeowner = self.create_codeowners(project=self.project)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = Integration.objects.get()

    @pytest.fixture(autouse=True)
    def patch_update_schema(self) -> Generator[None]:
        with mock.patch.object(ProjectCodeOwners, "update_schema") as self.mock_update:
            yield

    def test_no_op(self) -> None:
        with self.feature("organizations:integrations-codeowners"):
            update_code_owners_schema(self.organization.id)
        self.mock_update.assert_not_called()

    def test_with_project(self) -> None:
        with self.feature("organizations:integrations-codeowners"):
            update_code_owners_schema(self.organization.id, projects=[self.project.id])
        self.mock_update.assert_called_with(organization=self.organization)

    def test_with_integration(self) -> None:
        with self.feature("organizations:integrations-codeowners"):
            update_code_owners_schema(self.organization.id, integration=self.integration.id)
        self.mock_update.assert_called_with(organization=self.organization)

    def test_org_does_not_exist(self) -> None:
        with self.feature("organizations:integrations-codeowners"):
            update_code_owners_schema(organization=999999)
        self.mock_update.assert_not_called()

    def test_org_deletion_in_progress(self) -> None:
        self.organization.status = OrganizationStatus.DELETION_IN_PROGRESS
        self.organization.save()

        with self.feature("organizations:integrations-codeowners"):
            update_code_owners_schema(self.organization.id, projects=[self.project.id])
        self.mock_update.assert_not_called()

    def test_update_schema_raises_exception(self) -> None:
        self.mock_update.side_effect = Exception("test error")

        with (
            self.feature("organizations:integrations-codeowners"),
            pytest.raises(Exception, match="test error"),
        ):
            update_code_owners_schema(self.organization.id, projects=[self.project.id])

    def test_multiple_code_owners_updated(self) -> None:
        project2 = self.create_project(organization=self.organization)
        repo2 = self.create_repo(project2, name="other-repo")
        code_mapping2 = self.create_code_mapping(
            project2, repo2, stack_root="src/", source_root="src/"
        )
        self.create_codeowners(project=project2, code_mapping=code_mapping2)

        with self.feature("organizations:integrations-codeowners"):
            update_code_owners_schema(self.organization.id, projects=[self.project.id, project2.id])
        assert self.mock_update.call_count == 2

    def test_no_matching_code_owners(self) -> None:
        project_without_codeowners = self.create_project(organization=self.organization)

        with self.feature("organizations:integrations-codeowners"):
            update_code_owners_schema(
                self.organization.id, projects=[project_without_codeowners.id]
            )
        self.mock_update.assert_not_called()
