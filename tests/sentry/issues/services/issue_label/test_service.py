import pytest
from django.core.cache import cache

from sentry.issues.services.issue_label.cache import IssueLabelCache, OrganizationLabelCache
from sentry.issues.services.issue_label.service import IssueLabelService
from sentry.models.issuelabel import IssueLabel
from sentry.models.organizationlabel import OrganizationLabel
from sentry.testutils.cases import TestCase


class IssueLabelServiceTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.service = IssueLabelService()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)
        self.group = self.create_group(project=self.project)
        self.label = OrganizationLabel.objects.create(organization=self.org, label_name="priority")
        cache.clear()

    def tearDown(self) -> None:
        cache.clear()
        super().tearDown()

    def test_get_by_group_id_returns_empty_list_when_no_labels(self) -> None:
        result = self.service.get_by_group_id(self.group.id)
        assert result == []

    def test_get_by_group_id_returns_labels(self) -> None:
        IssueLabel.objects.create(group=self.group, label=self.label, label_value="high")
        result = self.service.get_by_group_id(self.group.id)
        assert len(result) == 1
        assert result[0].label_value == "high"
        assert result[0].label_id == self.label.id

    def test_get_by_group_id_populates_cache(self) -> None:
        IssueLabel.objects.create(group=self.group, label=self.label, label_value="high")
        assert IssueLabelCache.get(self.group.id) is None

        self.service.get_by_group_id(self.group.id)

        cached = IssueLabelCache.get(self.group.id)
        assert cached is not None
        assert len(cached) == 1

    def test_get_by_group_id_uses_cache_on_second_call(self) -> None:
        IssueLabel.objects.create(group=self.group, label=self.label, label_value="high")
        self.service.get_by_group_id(self.group.id)

        # Delete the DB row; cached result should still be returned
        IssueLabel.objects.filter(group=self.group).delete()
        result = self.service.get_by_group_id(self.group.id)
        assert len(result) == 1

    def test_create_persists_issue_label(self) -> None:
        issue_label = self.service.create(
            group_id=self.group.id,
            label_id=self.label.id,
            label_value="critical",
        )
        assert issue_label.id is not None
        assert IssueLabel.objects.filter(id=issue_label.id).exists()
        assert issue_label.group_id == self.group.id
        assert issue_label.label_id == self.label.id
        assert issue_label.label_value == "critical"

    def test_create_invalidates_cache(self) -> None:
        self.service.get_by_group_id(self.group.id)
        assert IssueLabelCache.get(self.group.id) is not None

        self.service.create(
            group_id=self.group.id,
            label_id=self.label.id,
            label_value="critical",
        )
        assert IssueLabelCache.get(self.group.id) is None

    def test_update_label_value(self) -> None:
        issue_label = IssueLabel.objects.create(
            group=self.group, label=self.label, label_value="low"
        )
        updated = self.service.update(
            issue_label_id=issue_label.id,
            label_value="high",
        )
        assert updated.label_value == "high"
        issue_label.refresh_from_db()
        assert issue_label.label_value == "high"

    def test_update_label_id(self) -> None:
        other_label = OrganizationLabel.objects.create(organization=self.org, label_name="severity")
        issue_label = IssueLabel.objects.create(
            group=self.group, label=self.label, label_value="low"
        )
        updated = self.service.update(
            issue_label_id=issue_label.id,
            label_id=other_label.id,
        )
        assert updated.label_id == other_label.id
        issue_label.refresh_from_db()
        assert issue_label.label_id == other_label.id

    def test_update_with_no_changes_still_invalidates_cache(self) -> None:
        issue_label = IssueLabel.objects.create(
            group=self.group, label=self.label, label_value="low"
        )
        self.service.get_by_group_id(self.group.id)
        assert IssueLabelCache.get(self.group.id) is not None

        self.service.update(issue_label_id=issue_label.id)
        assert IssueLabelCache.get(self.group.id) is None

    def test_update_invalidates_cache(self) -> None:
        issue_label = IssueLabel.objects.create(
            group=self.group, label=self.label, label_value="low"
        )
        self.service.get_by_group_id(self.group.id)
        assert IssueLabelCache.get(self.group.id) is not None

        self.service.update(issue_label_id=issue_label.id, label_value="high")
        assert IssueLabelCache.get(self.group.id) is None

    def test_update_nonexistent_raises(self) -> None:
        with pytest.raises(IssueLabel.DoesNotExist):
            self.service.update(issue_label_id=999999, label_value="high")

    def test_delete_removes_issue_label(self) -> None:
        issue_label = IssueLabel.objects.create(
            group=self.group, label=self.label, label_value="low"
        )
        self.service.delete(issue_label_id=issue_label.id)
        assert not IssueLabel.objects.filter(id=issue_label.id).exists()

    def test_delete_invalidates_cache(self) -> None:
        issue_label = IssueLabel.objects.create(
            group=self.group, label=self.label, label_value="low"
        )
        self.service.get_by_group_id(self.group.id)
        assert IssueLabelCache.get(self.group.id) is not None

        self.service.delete(issue_label_id=issue_label.id)
        assert IssueLabelCache.get(self.group.id) is None

    def test_delete_nonexistent_raises(self) -> None:
        with pytest.raises(IssueLabel.DoesNotExist):
            self.service.delete(issue_label_id=999999)


class OrganizationLabelServiceTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.service = IssueLabelService()
        self.org = self.create_organization()
        cache.clear()

    def tearDown(self) -> None:
        cache.clear()
        super().tearDown()

    def test_get_org_labels_returns_empty_list_when_none_exist(self) -> None:
        result = self.service.get_org_labels(self.org.id)
        assert result == []

    def test_get_org_labels_returns_labels_ordered_by_name(self) -> None:
        OrganizationLabel.objects.create(organization=self.org, label_name="severity")
        OrganizationLabel.objects.create(organization=self.org, label_name="environment")
        OrganizationLabel.objects.create(organization=self.org, label_name="priority")

        result = self.service.get_org_labels(self.org.id)
        assert len(result) == 3
        assert [label_model.label_name for label_model in result] == [
            "environment",
            "priority",
            "severity",
        ]

    def test_get_org_labels_populates_cache(self) -> None:
        OrganizationLabel.objects.create(organization=self.org, label_name="priority")
        assert OrganizationLabelCache.get(self.org.id) is None

        self.service.get_org_labels(self.org.id)

        cached = OrganizationLabelCache.get(self.org.id)
        assert cached is not None
        assert len(cached) == 1

    def test_get_org_labels_uses_cache_on_second_call(self) -> None:
        OrganizationLabel.objects.create(organization=self.org, label_name="priority")
        self.service.get_org_labels(self.org.id)

        # Delete the DB row; cached result should still be returned
        OrganizationLabel.objects.filter(organization=self.org).delete()
        result = self.service.get_org_labels(self.org.id)
        assert len(result) == 1

    def test_get_org_labels_only_returns_labels_for_given_org(self) -> None:
        other_org = self.create_organization()
        OrganizationLabel.objects.create(organization=self.org, label_name="priority")
        OrganizationLabel.objects.create(organization=other_org, label_name="severity")

        result = self.service.get_org_labels(self.org.id)
        assert len(result) == 1
        assert result[0].label_name == "priority"

    def test_create_org_label_persists(self) -> None:
        org_label = self.service.create_org_label(
            organization_id=self.org.id, label_name="priority"
        )
        assert org_label.id is not None
        assert OrganizationLabel.objects.filter(id=org_label.id).exists()
        assert org_label.organization_id == self.org.id
        assert org_label.label_name == "priority"

    def test_create_org_label_invalidates_cache(self) -> None:
        self.service.get_org_labels(self.org.id)
        assert OrganizationLabelCache.get(self.org.id) is not None

        self.service.create_org_label(organization_id=self.org.id, label_name="priority")
        assert OrganizationLabelCache.get(self.org.id) is None

    def test_update_org_label_changes_name(self) -> None:
        org_label = OrganizationLabel.objects.create(organization=self.org, label_name="priority")
        updated = self.service.update_org_label(org_label_id=org_label.id, label_name="severity")
        assert updated.label_name == "severity"
        org_label.refresh_from_db()
        assert org_label.label_name == "severity"

    def test_update_org_label_invalidates_cache(self) -> None:
        org_label = OrganizationLabel.objects.create(organization=self.org, label_name="priority")
        self.service.get_org_labels(self.org.id)
        assert OrganizationLabelCache.get(self.org.id) is not None

        self.service.update_org_label(org_label_id=org_label.id, label_name="severity")
        assert OrganizationLabelCache.get(self.org.id) is None

    def test_update_org_label_nonexistent_raises(self) -> None:
        with pytest.raises(OrganizationLabel.DoesNotExist):
            self.service.update_org_label(org_label_id=999999, label_name="x")

    def test_delete_org_label_removes_record(self) -> None:
        org_label = OrganizationLabel.objects.create(organization=self.org, label_name="priority")
        self.service.delete_org_label(org_label_id=org_label.id)
        assert not OrganizationLabel.objects.filter(id=org_label.id).exists()

    def test_delete_org_label_invalidates_cache(self) -> None:
        org_label = OrganizationLabel.objects.create(organization=self.org, label_name="priority")
        self.service.get_org_labels(self.org.id)
        assert OrganizationLabelCache.get(self.org.id) is not None

        self.service.delete_org_label(org_label_id=org_label.id)
        assert OrganizationLabelCache.get(self.org.id) is None

    def test_delete_org_label_nonexistent_raises(self) -> None:
        with pytest.raises(OrganizationLabel.DoesNotExist):
            self.service.delete_org_label(org_label_id=999999)
