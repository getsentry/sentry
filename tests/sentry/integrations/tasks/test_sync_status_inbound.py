from datetime import UTC, datetime, timedelta
from unittest import mock

import pytest
from django.utils import timezone as django_timezone

from sentry.constants import ObjectStatus
from sentry.integrations.example import ExampleIntegration
from sentry.integrations.mixins import ResolveSyncAction
from sentry.integrations.models import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.tasks.sync_status_inbound import (
    get_resolutions_and_activity_data_for_groups,
    sync_status_inbound,
)
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.grouplink import GroupLink
from sentry.models.groupresolution import GroupResolution
from sentry.models.release import ReleaseStatus
from sentry.signals import issue_unresolved
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.features import Feature, with_feature
from sentry.testutils.pytest.fixtures import django_db_all
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


@django_db_all
@pytest.mark.parametrize("finalized_order", [False, True], ids=["flag-off", "flag-on"])
@pytest.mark.parametrize(
    "latest_version, anchor_status, expected_resolution_version, expected_anchor_version",
    [
        pytest.param("app@1.0.2", ReleaseStatus.OPEN, "app@1.0.2", "app@1.0.2", id="semver"),
        pytest.param("build-sha", ReleaseStatus.OPEN, "app@1.0.1", "app@1.0.0", id="date"),
        pytest.param("build-sha", None, "app@1.0.1", "app@1.0.0", id="date-null-status"),
        pytest.param(
            "build-sha", ReleaseStatus.ARCHIVED, "build-sha", None, id="date-no-eligible-anchor"
        ),
    ],
)
def test_resolve_next_release_skips_archived_successor(
    factories: Factories,
    default_group: Group,
    finalized_order: bool,
    latest_version: str,
    anchor_status: int | None,
    expected_resolution_version: str,
    expected_anchor_version: str | None,
) -> None:
    project = default_group.project
    now = django_timezone.now()
    anchor = factories.create_release(
        project=project,
        version="app@1.0.0",
        date_added=now - timedelta(days=3),
        status=anchor_status,
    )
    factories.create_group_release(project=project, group=default_group, release=anchor).update(
        last_seen=now - timedelta(hours=2)
    )
    archived = factories.create_release(
        project=project,
        version="app@999.9+999.9",
        date_added=now - timedelta(days=2),
        status=ReleaseStatus.ARCHIVED,
    )
    factories.create_group_release(project=project, group=default_group, release=archived).update(
        last_seen=now - timedelta(hours=1)
    )
    factories.create_release(
        project=project, version="app@1.0.1", date_added=now - timedelta(days=1)
    )
    # A non-semver latest release sends inbound sync through date ordering,
    # even when subsequent semver events use version comparisons.
    factories.create_release(project=project, version=latest_version, date_added=now)
    with assume_test_silo_mode(SiloMode.CONTROL):
        integration = factories.create_integration(
            organization=project.organization,
            provider="example",
            external_id="123456",
            oi_params={
                "config": {
                    "sync_status_inbound": True,
                    "resolution_strategy": "resolve_next_release",
                }
            },
        )
    factories.create_integration_external_issue(
        group=default_group, integration=integration, key=TEST_ISSUE_KEY
    )

    with (
        Feature({"organizations:release-resolution-finalized-order": finalized_order}),
        mock.patch.object(
            ExampleIntegration, "get_resolve_sync_action", return_value=ResolveSyncAction.RESOLVE
        ),
    ):
        sync_status_inbound(
            integration_id=integration.id,
            organization_id=project.organization_id,
            issue_key=TEST_ISSUE_KEY,
            data=fake_data,
        )

    default_group.refresh_from_db()
    assert default_group.status == GroupStatus.RESOLVED
    newer = factories.create_release(project=project, version="app@1.0.3")
    with Feature({"organizations:release-resolution-finalized-order": finalized_order}):
        assert GroupResolution.has_resolution(default_group, anchor)
        assert not GroupResolution.has_resolution(default_group, newer)

    resolution = GroupResolution.objects.get(group=default_group)
    assert resolution.release.version == expected_resolution_version
    assert resolution.current_release_version == expected_anchor_version
    activity = Activity.objects.get(
        group=default_group, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
    )
    assert activity.ident == str(resolution.id)
    assert activity.data["inNextRelease"] is True
    assert archived.version not in activity.data.values()


class TestSyncStatusInbound(TestCase):
    def setUp(self) -> None:
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
    def test_resolve_default(self, mock_get_resolve_sync_action: mock.MagicMock) -> None:
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
    def test_unresolve(self, mock_get_resolve_sync_action: mock.MagicMock) -> None:
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
    def test_noop(self, mock_get_resolve_sync_action: mock.MagicMock) -> None:
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

    def test_integration_not_found(self) -> None:
        with pytest.raises(Integration.DoesNotExist):
            sync_status_inbound(
                integration_id=99999,
                organization_id=self.organization.id,
                issue_key=TEST_ISSUE_KEY,
                data=fake_data,
            )

    def test_integration_inactive(self) -> None:
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

    def test_organization_not_found(self) -> None:
        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=99999,
            issue_key=TEST_ISSUE_KEY,
            data=fake_data,
        )
        self.group.refresh_from_db()
        assert self.group.status == GroupStatus.UNRESOLVED

    def test_no_affected_groups(self) -> None:
        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            issue_key="NONEXISTENT-123",
            data=fake_data,
        )

        self._assert_group_unresolved(self.group.id)

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_resolve_next_release(self, mock_get_resolve_sync_action: mock.MagicMock) -> None:
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

        # Verify the activity is linked to GroupResolution via ident
        resolution = GroupResolution.objects.get(group=self.group)
        activity = (
            Activity.objects.filter(
                group=self.group, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
            )
            .order_by("-datetime")
            .first()
        )
        assert activity is not None
        assert activity.ident == str(resolution.id)

    @with_feature("organizations:release-resolution-finalized-order")
    @mock.patch(
        "sentry.integrations.tasks.sync_status_inbound.get_current_release_version_of_group"
    )
    def test_resolve_next_release_uses_finalized_release_order(
        self, mock_get_current_release_version: mock.MagicMock
    ) -> None:
        now = django_timezone.now()
        current_release = self.create_release(
            project=self.project,
            version="current release",
            date_added=now - timedelta(minutes=30),
            date_released=now - timedelta(minutes=30),
        )
        next_release = self.create_release(
            project=self.project,
            version="next release",
            date_added=now - timedelta(minutes=60),
            date_released=now - timedelta(minutes=10),
        )
        self.create_release(
            project=self.project,
            version="late registered old release",
            date_added=now,
            date_released=now - timedelta(minutes=60),
        )
        mock_get_current_release_version.return_value = current_release.version

        resolutions, _, _ = get_resolutions_and_activity_data_for_groups(
            affected_groups=[self.group],
            resolution_strategy="resolve_next_release",
            activity_data={},
            organization_id=self.organization.id,
        )

        assert resolutions[self.group.id]["release"] == next_release

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_resolve_current_release(self, mock_get_resolve_sync_action: mock.MagicMock) -> None:
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

        # Verify the activity is linked to GroupResolution via ident
        resolution = GroupResolution.objects.get(group=self.group)
        activity = (
            Activity.objects.filter(
                group=self.group, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
            )
            .order_by("-datetime")
            .first()
        )
        assert activity is not None
        assert activity.ident == str(resolution.id)

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_resolve_no_releases(self, mock_get_resolve_sync_action: mock.MagicMock) -> None:
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
    def test_recently_resolved_skip(self, mock_get_resolve_sync_action: mock.MagicMock) -> None:
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
    def test_multiple_groups(self, mock_get_resolve_sync_action: mock.MagicMock) -> None:
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
    def test_api_error(self, mock_get_resolve_sync_action: mock.MagicMock) -> None:
        mock_get_resolve_sync_action.side_effect = Exception("API Error")

        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            issue_key=TEST_ISSUE_KEY,
            data=fake_data,
        )

        self._assert_group_unresolved(self.group.id)

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_resolve_ignored_group(self, mock_get_resolve_sync_action: mock.MagicMock) -> None:
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

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_unresolve_skips_already_unresolved_group(
        self, mock_get_resolve_sync_action: mock.MagicMock
    ) -> None:
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.UNRESOLVE

        with mock.patch.object(issue_unresolved, "send_robust") as mock_signal:
            sync_status_inbound(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
                issue_key=TEST_ISSUE_KEY,
                data=fake_data,
            )

        self._assert_group_unresolved(self.group.id)
        assert mock_signal.call_count == 0
        assert self.group.activity_set.filter(type=ActivityType.SET_UNRESOLVED.value).count() == 0

    def _sync(self, provider_event_time: str | None) -> None:
        sync_status_inbound(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            issue_key=TEST_ISSUE_KEY,
            data={**fake_data, "provider_event_time": provider_event_time},
        )

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_out_of_order_resolve_is_ignored(
        self, mock_get_resolve_sync_action: mock.MagicMock
    ) -> None:
        self.group.update(status=GroupStatus.RESOLVED, substatus=None)

        mock_get_resolve_sync_action.return_value = ResolveSyncAction.UNRESOLVE
        self._sync("2023-01-01T00:00:03Z")

        # The close the reopen above superseded is redelivered off the backlog.
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.RESOLVE
        self._sync("2023-01-01T00:00:00Z")

        self._assert_group_unresolved(self.group.id)
        self._assert_no_resolve_activity()

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_replayed_event_does_not_reapply(
        self, mock_get_resolve_sync_action: mock.MagicMock
    ) -> None:
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.UNRESOLVE
        self._sync("2023-01-01T00:00:00Z")

        # A human resolves the Sentry issue after the event was applied.
        self.group.update(status=GroupStatus.RESOLVED, substatus=None)

        self._sync("2023-01-01T00:00:00Z")

        self._assert_group_resolved(self.group.id)

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_newer_event_is_applied(self, mock_get_resolve_sync_action: mock.MagicMock) -> None:
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.UNRESOLVE
        self._sync("2023-01-01T00:00:00Z")

        mock_get_resolve_sync_action.return_value = ResolveSyncAction.RESOLVE
        self._sync("2023-01-01T00:00:03Z")

        self._assert_group_resolved(self.group.id)
        self._assert_resolve_activity_created()

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_events_without_provider_time_are_always_applied(
        self, mock_get_resolve_sync_action: mock.MagicMock
    ) -> None:
        # Payloads without a provider timestamp must keep syncing.
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.UNRESOLVE
        self._sync(None)

        mock_get_resolve_sync_action.return_value = ResolveSyncAction.RESOLVE
        self._sync(None)

        self._assert_group_resolved(self.group.id)

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_noop_event_advances_the_watermark(
        self, mock_get_resolve_sync_action: mock.MagicMock
    ) -> None:
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.NOOP
        self._sync("2023-01-01T00:00:03Z")

        mock_get_resolve_sync_action.return_value = ResolveSyncAction.RESOLVE
        self._sync("2023-01-01T00:00:00Z")

        self._assert_group_unresolved(self.group.id)
        self._assert_no_resolve_activity()

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_failed_action_lookup_leaves_the_watermark_alone(
        self, mock_get_resolve_sync_action: mock.MagicMock
    ) -> None:
        # The event was never applied, so a redelivery of it has to be allowed through.
        mock_get_resolve_sync_action.side_effect = Exception("API Error")
        self._sync("2023-01-01T00:00:00Z")

        mock_get_resolve_sync_action.side_effect = None
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.RESOLVE
        self._sync("2023-01-01T00:00:00Z")

        self._assert_group_resolved(self.group.id)

    @mock.patch.object(ExampleIntegration, "get_resolve_sync_action")
    def test_watermark_never_moves_backwards(
        self, mock_get_resolve_sync_action: mock.MagicMock
    ) -> None:
        mock_get_resolve_sync_action.return_value = ResolveSyncAction.NOOP
        self._sync("2023-01-01T00:00:03Z")
        self._sync("2023-01-01T00:00:00Z")

        self.external_issue.refresh_from_db()
        assert self.external_issue.provider_status_updated_at == datetime(
            2023, 1, 1, 0, 0, 3, tzinfo=UTC
        )
