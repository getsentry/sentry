from datetime import timedelta
from unittest import mock

import pytest
from django.utils import timezone as django_timezone

from sentry.constants import ObjectStatus
from sentry.integrations.example import ExampleIntegration
from sentry.integrations.mixins import ResolveSyncAction
from sentry.integrations.models import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.tasks.sync_status_inbound import sync_status_inbound
from sentry.models.group import Group, GroupStatus
from sentry.models.grouplink import GroupLink
from sentry.models.groupresolution import GroupResolution
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus

TEST_ISSUE_KEY = "TEST-123"

fake_data = {
    "status": {
        "id": "some_status",
    }
}

fake_activity_data = {
    "provider": "test",
    "provider_key": "test",
    "integration_id": 123456,
}


class TestSyncStatusInbound(TestCase):
    def setUp(self):
        self.organization = self.create_organization(owner=self.create_user())
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.ONGOING,
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_integration(
                organization=self.organization,
                provider="example",
                external_id="123456",
                oi_params={
                    "config": {
                        "sync_comments": True,
                        "sync_status_outbound": True,
                        "sync_status_inbound": True,
                        "sync_assignee_outbound": True,
                        "sync_assignee_inbound": True,
                    }
                },
            )

        self.external_issue = self.create_integration_external_issue(
            group=self.group, integration=self.integration, key=TEST_ISSUE_KEY
        )

    def _assert_group_resolved(self, group_id: int):
        group = Group.objects.get(id=group_id)
        assert group.status == GroupStatus.RESOLVED

    def _assert_group_unresolved(self, group_id: int):
        group = Group.objects.get(id=group_id)
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.ONGOING

    def _assert_resolve_activity_created(self, additional_data=None):
        activity = self.group.activity_set.filter(type=ActivityType.SET_RESOLVED.value).first()
        assert activity is not None
        assert activity.data["provider"] == "Example"
        assert activity.data["provider_key"] == "example"
        assert activity.data["integration_id"] == self.integration.id

        if additional_data:
            for key, value in additional_data.items():
                assert activity.data.get(key) == value

    def _assert_unresolve_activity_created(self):
        activity = self.group.activity_set.filter(type=ActivityType.SET_UNRESOLVED.value).first()
        assert activity is not None
        assert activity.data["provider"] == "Example"
        assert activity.data["provider_key"] == "example"
        assert activity.data["integration_id"] == self.integration.id

    def _assert_resolve_in_release_activity_created(
        self, in_next_release=False, additional_data=None
    ):
        activity = self.group.activity_set.filter(
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value
        ).first()
        assert activity is not None
        assert activity.data["provider"] == "Example"
        assert activity.data["provider_key"] == "example"
        assert activity.data["integration_id"] == self.integration.id

        if in_next_release:
            assert activity.data.get("inNextRelease") is True
        else:
            assert "inNextRelease" not in activity.data

        if additional_data:
            for key, value in additional_data.items():
                assert activity.data.get(key) == value

    def _assert_no_resolve_activity(self):
        activity_count = self.group.activity_set.filter(
            type=ActivityType.SET_RESOLVED.value
        ).count()
        assert activity_count == 0

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_resolve_default(self, mock_get_resolve_sync_action):
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.RESOLVE

        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            issue_key=TEST_ISSUE_KEY,
            data=fake_data,
        )

        self._assert_group_resolved(self.group.id)
        self._assert_resolve_activity_created()

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_unresolve(self, mock_get_resolve_sync_action):
        self.group.update(status=GroupStatus.RESOLVED)

        mock_get_resolve_sync_action.return_value = ResolveSyncAction.UNRESOLVE

        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            issue_key=TEST_ISSUE_KEY,
            data=fake_data,
        )

        self._assert_group_unresolved(self.group.id)
        self._assert_unresolve_activity_created()

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_noop(self, mock_get_resolve_sync_action):
        original_status = self.group.status
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.NOOP

        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            issue_key=TEST_ISSUE_KEY,
            data=fake_data,
        )

        self.group.refresh_from_db()
        assert self.group.status == original_status

    def test_integration_not_found(self):
        with pytest.raises(Integration.DoesNotExist):
            sync_status_inbound(
                integration_id=99999,
                organization_id=self.organization.id,
                issue_key=TEST_ISSUE_KEY,
                data=fake_data,
            )

    def test_integration_inactive(self):
        integration = self.create_integration(
            organization=self.organization,
            provider="example",
            external_id="inactive",
            status=ObjectStatus.DISABLED,
        )

        sync_status_inbound(
            integration_id=integration.id,
            organization_id=self.organization.id,
            issue_key=TEST_ISSUE_KEY,
            data=fake_data,
        )
        self._assert_group_unresolved(self.group.id)

    def test_organization_not_found(self):
        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=99999,
            issue_key=TEST_ISSUE_KEY,
            data=fake_data,
        )
        self.group.refresh_from_db()
        assert self.group.status == GroupStatus.UNRESOLVED

    def test_no_affected_groups(self):
        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            issue_key="NONEXISTENT-123",
            data=fake_data,
        )

        self._assert_group_unresolved(self.group.id)

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_resolve_next_release(self, mock_get_resolve_sync_action):
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.RESOLVE

        self.create_release(project=self.project, version="1.0.0")
        self.create_release(project=self.project, version="2.0.0")

        with assume_test_silo_mode(SiloMode.CONTROL):
            org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )
            org_integration.update(
                config={
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                    "resolution_strategy": "resolve_next_release",
                },
            )

        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            issue_key=TEST_ISSUE_KEY,
            data=fake_data,
        )

        self._assert_group_resolved(self.group.id)
        self._assert_resolve_in_release_activity_created(in_next_release=True)

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_resolve_current_release(self, mock_get_resolve_sync_action):
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.RESOLVE

        self.create_release(project=self.project, version="1.0.0")

        with assume_test_silo_mode(SiloMode.CONTROL):
            org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )
            org_integration.update(
                config={
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                    "resolution_strategy": "resolve_current_release",
                },
            )

        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            issue_key=TEST_ISSUE_KEY,
            data=fake_data,
        )

        self._assert_group_resolved(self.group.id)
        self._assert_resolve_in_release_activity_created(in_next_release=False)

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_resolve_no_releases(self, mock_get_resolve_sync_action):
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.RESOLVE

        with assume_test_silo_mode(SiloMode.CONTROL):
            org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )
            org_integration.update(
                config={
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                    "resolution_strategy": "resolve_next_release",
                },
            )

        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            issue_key=TEST_ISSUE_KEY,
            data=fake_data,
        )

        self._assert_group_resolved(self.group.id)
        self._assert_resolve_activity_created()

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_recently_resolved_skip(self, mock_get_resolve_sync_action):
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.RESOLVE

        release = self.create_release(project=self.project, version="1.0.0")

        self.group.update(status=GroupStatus.RESOLVED)
        GroupResolution.objects.create(
            group=self.group,
            datetime=django_timezone.now() - timedelta(minutes=1),
            release_id=release.id,
        )

        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            issue_key=TEST_ISSUE_KEY,
            data=fake_data,
        )

        self._assert_group_resolved(self.group.id)
        self._assert_no_resolve_activity()

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_multiple_groups(self, mock_get_resolve_sync_action):
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.RESOLVE

        group2 = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)
        GroupLink.objects.create(
            group_id=group2.id,
            project_id=group2.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=self.external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            issue_key=TEST_ISSUE_KEY,
            data=fake_data,
        )

        self._assert_group_resolved(self.group.id)
        self._assert_group_resolved(group2.id)

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_api_error(self, mock_get_resolve_sync_action):
        mock_get_resolve_sync_action.side_effect = Exception("API Error")

        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            issue_key=TEST_ISSUE_KEY,
            data=fake_data,
        )

        self._assert_group_unresolved(self.group.id)

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_resolve_ignored_group(self, mock_get_resolve_sync_action):
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.RESOLVE
        self.group.update(status=GroupStatus.IGNORED)

        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            issue_key=TEST_ISSUE_KEY,
            data=fake_data,
        )

        group = Group.objects.get(id=self.group.id)
        assert group.status == GroupStatus.IGNORED
        assert group.substatus == GroupSubStatus.ONGOING
