from __future__ import annotations

from unittest import mock

import pytest
from django.db import IntegrityError

from sentry.db.models.fields.bounded import I64_MAX
from sentry.investigations.models import (
    Investigation,
    InvestigationBlockDependency,
    InvestigationProject,
    InvestigationSourceType,
    InvestigationStatus,
)
from sentry.investigations.services.investigations import (
    InvestigationSourceNotFound,
    InvestigationValidationError,
    _resolve_breached_metric_source,
    archive_investigation,
    create_block,
    create_manual_investigation,
    create_template_investigation,
    delete_block,
    lock_investigation,
    update_investigation,
)
from sentry.testutils.cases import TestCase

TEMPLATE_KWARGS = {
    "organization": mock.sentinel.organization,
    "user_id": 1,
    "template_key": "breached_metric",
    "template_version": 1,
    "source_ref": {},
    "supplied_parameters": {},
    "accessible_project_ids": set(),
}


def test_template_creation_retries_revision_uniqueness_collisions() -> None:
    created = mock.sentinel.investigation
    with mock.patch(
        "sentry.investigations.services.investigations._create_template_investigation",
        side_effect=[IntegrityError(), created],
    ) as create:
        result = create_template_investigation(**TEMPLATE_KWARGS)

    assert result is created
    assert create.call_count == 2


def test_template_creation_succeeds_without_a_collision() -> None:
    created = mock.sentinel.investigation
    with mock.patch(
        "sentry.investigations.services.investigations._create_template_investigation",
        return_value=created,
    ) as create:
        result = create_template_investigation(**TEMPLATE_KWARGS)

    assert result is created
    assert create.call_count == 1


def test_template_creation_reraises_after_exhausting_retries() -> None:
    with mock.patch(
        "sentry.investigations.services.investigations._create_template_investigation",
        side_effect=IntegrityError(),
    ) as create:
        with pytest.raises(IntegrityError):
            create_template_investigation(**TEMPLATE_KWARGS)

    assert create.call_count == 3


class ProjectLinkScopingTest(TestCase):
    def test_create_rejects_projects_from_another_organization(self) -> None:
        other_organization = self.create_organization(name="other")
        foreign_project = self.create_project(organization=other_organization)

        with pytest.raises(InvestigationValidationError) as excinfo:
            create_manual_investigation(
                organization=self.organization,
                user_id=self.user.id,
                title="Investigation",
                project_ids=[foreign_project.id],
                filters={},
            )

        assert "projectIds" in excinfo.value.errors
        assert not InvestigationProject.objects.filter(project_id=foreign_project.id).exists()

    def test_create_accepts_projects_in_the_organization(self) -> None:
        investigation = create_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Investigation",
            project_ids=[self.project.id],
            filters={},
        )

        assert list(
            InvestigationProject.objects.filter(investigation=investigation).values_list(
                "project_id", flat=True
            )
        ) == [self.project.id]

    def test_update_rejects_projects_from_another_organization(self) -> None:
        other_organization = self.create_organization(name="other")
        foreign_project = self.create_project(organization=other_organization)
        investigation = create_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Investigation",
            project_ids=[self.project.id],
            filters={},
        )

        with pytest.raises(InvestigationValidationError):
            update_investigation(
                investigation=investigation,
                expected_version=investigation.version,
                fields={},
                project_ids=[foreign_project.id],
            )

        assert not InvestigationProject.objects.filter(project_id=foreign_project.id).exists()


class DeleteBlockStalenessTest(TestCase):
    def test_deleting_an_upstream_block_marks_its_dependents_stale(self) -> None:
        investigation = create_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Investigation",
            project_ids=[],
            filters={},
        )
        upstream = create_block(
            investigation=investigation,
            expected_investigation_version=investigation.version,
            user_id=self.user.id,
            values={"kind": "query"},
        )
        investigation.refresh_from_db()
        dependent = create_block(
            investigation=investigation,
            expected_investigation_version=investigation.version,
            user_id=self.user.id,
            values={"kind": "text"},
        )
        investigation.refresh_from_db()
        InvestigationBlockDependency.objects.create(block=dependent, depends_on=upstream)
        assert dependent.stale_at is None

        delete_block(
            block=upstream,
            expected_investigation_version=investigation.version,
            expected_block_version=upstream.version,
        )

        dependent.refresh_from_db()
        assert dependent.stale_at is not None


class BreachedMetricSourceRefTest(TestCase):
    def test_out_of_range_ids_are_treated_as_a_missing_source(self) -> None:
        with pytest.raises(InvestigationSourceNotFound):
            _resolve_breached_metric_source(
                organization=self.organization,
                source_ref={"groupId": str(I64_MAX + 1), "openPeriodId": "1"},
                accessible_project_ids={self.project.id},
            )

    def test_non_positive_ids_are_treated_as_a_missing_source(self) -> None:
        with pytest.raises(InvestigationSourceNotFound):
            _resolve_breached_metric_source(
                organization=self.organization,
                source_ref={"groupId": "0", "openPeriodId": "1"},
                accessible_project_ids={self.project.id},
            )


class ConcurrentModificationTest(TestCase):
    def lineage_pair(self) -> tuple[Investigation, Investigation]:
        first = create_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="First",
            project_ids=[],
            filters={},
        )
        second = create_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Second",
            project_ids=[],
            filters={},
        )
        for revision, investigation in enumerate((first, second), start=1):
            Investigation.objects.filter(id=investigation.id).update(
                source_type=InvestigationSourceType.BREACHED_METRIC,
                source_key="lineage",
                source_revision=revision,
            )
            investigation.refresh_from_db()
        return first, second

    def test_cascade_archive_bumps_sibling_versions(self) -> None:
        """
        Siblings are archived by a bulk update, so without a version bump a
        client holding a stale reference would still pass the optimistic lock.
        """
        first, second = self.lineage_pair()
        before = second.version

        archive_investigation(investigation=first, expected_version=first.version)

        second.refresh_from_db()
        assert second.status == InvestigationStatus.ARCHIVED
        assert second.version == before + 1

    def test_locking_a_deleted_investigation_is_a_missing_source(self) -> None:
        """A concurrent delete should not surface as an unhandled 500."""
        investigation = create_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Gone",
            project_ids=[],
            filters={},
        )
        Investigation.objects.filter(id=investigation.id).delete()

        with pytest.raises(InvestigationSourceNotFound):
            lock_investigation(investigation, investigation.version)


class UpdateFieldAllowlistTest(TestCase):
    def test_rejects_fields_outside_the_allowlist(self) -> None:
        """The service does not trust its caller to have filtered `fields`."""
        other_organization = self.create_organization(name="other")
        investigation = create_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Investigation",
            project_ids=[],
            filters={},
        )

        with pytest.raises(InvestigationValidationError):
            update_investigation(
                investigation=investigation,
                expected_version=investigation.version,
                fields={"organization_id": other_organization.id},
                project_ids=None,
            )

        investigation.refresh_from_db()
        assert investigation.organization_id == self.organization.id

    def test_accepts_the_allowlisted_fields(self) -> None:
        investigation = create_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Investigation",
            project_ids=[],
            filters={},
        )

        updated = update_investigation(
            investigation=investigation,
            expected_version=investigation.version,
            fields={"title": "Renamed", "filters": {"environment": ["prod"]}},
            project_ids=None,
        )

        assert updated.title == "Renamed"
        assert updated.filters == {"environment": ["prod"]}
