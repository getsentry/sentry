from typing import Any
from uuid import uuid4

import pytest

from sentry.auth.access import ServiceAccountAccess, from_user
from sentry.constants import ObjectStatus
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.notebooks.access import (
    can_view_notebook,
    filter_visible_notebooks,
    has_notebooks_access,
)
from sentry.notebooks.models import Notebook, NotebookSourceType
from sentry.testutils.cases import BaseTestCase, TestCase
from sentry.testutils.helpers.features import with_feature


class HasNotebooksAccessTest(TestCase):
    def set_open_membership(self, enabled: bool) -> None:
        self.organization.flags.allow_joinleave = enabled
        self.organization.save()

    @with_feature("organizations:investigations")
    def test_feature_and_open_membership(self) -> None:
        self.set_open_membership(True)

        assert has_notebooks_access(self.organization, actor=self.user) is True

    def test_requires_the_feature(self) -> None:
        self.set_open_membership(True)

        assert has_notebooks_access(self.organization, actor=self.user) is False

    @with_feature("organizations:investigations")
    def test_requires_open_membership(self) -> None:
        self.set_open_membership(False)

        assert has_notebooks_access(self.organization, actor=self.user) is False


@pytest.mark.django_db(databases=["default", "control"])
class TestNotebookSourceVisibility(BaseTestCase):
    def notebook(self, source: dict[str, Any]) -> Notebook:
        return self.create_notebook(
            self.organization,
            source_type=NotebookSourceType.METRIC_OPEN_PERIOD,
            source_key=f"metric_open_period:{uuid4()}",
            source_revision=1,
            source=source,
        )

    def test_current_project_access_is_independent_of_availability(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        user = self.create_user()
        self.create_member(organization=self.organization, user=user, teams=[self.team])
        notebook = self.notebook(
            {"type": "metric_open_period", "snapshot": {"project": {"id": str(self.project.id)}}}
        )
        other = self.create_project(organization=self.organization, teams=[])
        hidden = self.notebook(
            {"type": "metric_open_period", "snapshot": {"project": {"id": other.id}}}
        )
        manual = self.create_notebook(self.organization)
        access = from_user(user, self.organization)
        assert can_view_notebook(notebook, access)
        assert not can_view_notebook(hidden, access)
        assert set(filter_visible_notebooks(Notebook.objects.all(), access)) == {notebook, manual}

        OrganizationMemberTeam.objects.filter(
            organizationmember__user_id=user.id, team=self.team
        ).delete()
        assert not can_view_notebook(notebook, from_user(user, self.organization))

    @pytest.mark.parametrize("all_projects", [False, True])
    def test_service_account_grants(self, all_projects: bool) -> None:
        account = self.create_service_account(
            organization=self.organization,
            scope_list=["org:read"],
            project_ids=[self.project.id],
            all_projects=all_projects,
        )
        other = self.create_project(organization=self.organization)
        access = ServiceAccountAccess(
            service_account_id=account.id,
            organization_id=self.organization.id,
            scopes=["org:read"],
            all_projects=all_projects,
        )
        notebook = self.notebook(
            {"type": "metric_open_period", "snapshot": {"project": {"id": self.project.id}}}
        )
        hidden = self.notebook(
            {"type": "metric_open_period", "snapshot": {"project": {"id": str(other.id)}}}
        )
        assert can_view_notebook(notebook, access)
        assert can_view_notebook(hidden, access) == all_projects

    @pytest.mark.parametrize(
        "source",
        [
            {},
            {"type": "metric_open_period"},
            {"type": "metric_open_period", "snapshot": None},
            {"type": "metric_open_period", "snapshot": {"project": []}},
            {"type": "metric_open_period", "snapshot": {"project": {"id": None}}},
            {"type": "metric_open_period", "snapshot": {"project": {"id": "invalid"}}},
            {"type": "metric_open_period", "snapshot": {"project": {"id": {"id": 1}}}},
            {"type": "metric_open_period", "snapshot": {"project": {"id": True}}},
        ],
    )
    def test_malformed_provenance_is_hidden(self, source: dict[str, Any]) -> None:
        notebook = self.notebook(source)
        access = from_user(self.user, self.organization)
        assert not can_view_notebook(notebook, access)
        assert list(filter_visible_notebooks(Notebook.objects.all(), access)) == []

    def test_foreign_inactive_deleted_and_inconsistent_sources_are_hidden(self) -> None:
        foreign = self.create_project(organization=self.create_organization())
        inactive = self.create_project(
            organization=self.organization, status=ObjectStatus.PENDING_DELETION
        )
        deleted = self.create_project(organization=self.organization)
        deleted_id = deleted.id
        deleted.delete()
        for project_id in (foreign.id, inactive.id, deleted_id):
            self.notebook(
                {"type": "metric_open_period", "snapshot": {"project": {"id": str(project_id)}}}
            )
        self.notebook({"type": "manual", "snapshot": {"project": {"id": self.project.id}}})
        assert not filter_visible_notebooks(
            Notebook.objects.all(), from_user(self.user, self.organization)
        ).exists()
