from unittest.mock import patch

from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.utils import external_issue_key
from sentry.integrations.utils.external_issue_key import (
    PROVIDER_ISSUE_ID_KEY,
    rekey_external_issues,
)
from sentry.models.grouplink import GroupLink
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class RekeyExternalIssuesTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="jira:123",
            provider="jira",
        )

    def _linked_group_ids(self, external_issue: ExternalIssue) -> set[int]:
        return set(
            GroupLink.objects.filter(
                linked_type=GroupLink.LinkedType.issue, linked_id=external_issue.id
            ).values_list("group_id", flat=True)
        )

    def test_renames_in_place(self) -> None:
        group = self.create_group()
        external_issue = self.create_integration_external_issue(
            group=group, integration=self.integration, key="APP-123"
        )

        assert rekey_external_issues(self.integration, "APP-123", "PLATFORM-45") == 1

        external_issue.refresh_from_db()
        assert external_issue.key == "PLATFORM-45"
        # The link itself is untouched, so the group stays attached to the same row.
        assert self._linked_group_ids(external_issue) == {group.id}

    def test_records_provider_issue_id(self) -> None:
        group = self.create_group()
        external_issue = self.create_integration_external_issue(
            group=group, integration=self.integration, key="APP-123"
        )

        rekey_external_issues(self.integration, "APP-123", "PLATFORM-45", provider_issue_id="10101")

        external_issue.refresh_from_db()
        assert external_issue.metadata[PROVIDER_ISSUE_ID_KEY] == "10101"

    def test_preserves_existing_metadata(self) -> None:
        group = self.create_group()
        external_issue = self.create_integration_external_issue(
            group=group,
            integration=self.integration,
            key="APP-123",
            metadata={"display_name": "APP-123"},
        )

        rekey_external_issues(self.integration, "APP-123", "PLATFORM-45", provider_issue_id="10101")

        external_issue.refresh_from_db()
        assert external_issue.metadata == {
            "display_name": "APP-123",
            PROVIDER_ISSUE_ID_KEY: "10101",
        }

    def test_noop_when_key_unchanged(self) -> None:
        group = self.create_group()
        self.create_integration_external_issue(
            group=group, integration=self.integration, key="APP-123"
        )

        assert rekey_external_issues(self.integration, "APP-123", "APP-123") == 0

    def test_noop_when_issue_is_not_linked(self) -> None:
        # By far the common case: Jira moves an issue nobody ever linked to Sentry.
        assert rekey_external_issues(self.integration, "APP-123", "PLATFORM-45") == 0

    def test_leaves_other_integrations_alone(self) -> None:
        other_integration = self.create_integration(
            organization=self.organization,
            external_id="jira:456",
            provider="jira",
        )
        group = self.create_group()
        untouched = self.create_integration_external_issue(
            group=group, integration=other_integration, key="APP-123"
        )

        assert rekey_external_issues(self.integration, "APP-123", "PLATFORM-45") == 0

        untouched.refresh_from_db()
        assert untouched.key == "APP-123"

    def test_merges_into_existing_row_at_new_key(self) -> None:
        # Someone linked the issue again under its new key before the move webhook landed;
        # (organization, integration, key) is unique, so the rows have to be merged.
        moved_group = self.create_group()
        stale = self.create_integration_external_issue(
            group=moved_group, integration=self.integration, key="APP-123"
        )
        other_group = self.create_group()
        survivor = self.create_integration_external_issue(
            group=other_group, integration=self.integration, key="PLATFORM-45"
        )

        assert rekey_external_issues(self.integration, "APP-123", "PLATFORM-45") == 1

        assert not ExternalIssue.objects.filter(id=stale.id).exists()
        survivor.refresh_from_db()
        assert survivor.key == "PLATFORM-45"
        assert self._linked_group_ids(survivor) == {moved_group.id, other_group.id}

    def test_merges_survivor_created_after_lookup(self) -> None:
        moved_group = self.create_group()
        stale = self.create_integration_external_issue(
            group=moved_group, integration=self.integration, key="APP-123"
        )
        other_group = self.create_group()
        survivor = self.create_integration_external_issue(
            group=other_group, integration=self.integration, key="PLATFORM-45"
        )

        # Simulate the survivor being created after the first lookup. The attempted
        # rename then raises IntegrityError on the unique key and enters reconciliation.
        with patch.object(external_issue_key, "_find_survivor", side_effect=[None, survivor]):
            assert rekey_external_issues(self.integration, "APP-123", "PLATFORM-45") == 1

        assert not ExternalIssue.objects.filter(id=stale.id).exists()
        assert self._linked_group_ids(survivor) == {moved_group.id, other_group.id}

    def test_retries_rename_when_conflicting_survivor_disappears(self) -> None:
        moved_group = self.create_group()
        stale = self.create_integration_external_issue(
            group=moved_group, integration=self.integration, key="APP-123"
        )
        survivor = self.create_integration_external_issue(
            group=self.create_group(), integration=self.integration, key="PLATFORM-45"
        )

        def find_survivor(
            stale_issue: ExternalIssue, new_key: str, *, for_update: bool = False
        ) -> ExternalIssue | None:
            if for_update:
                survivor.delete()
            return None

        with patch.object(external_issue_key, "_find_survivor", side_effect=find_survivor):
            assert rekey_external_issues(self.integration, "APP-123", "PLATFORM-45") == 1

        stale.refresh_from_db()
        assert stale.key == "PLATFORM-45"
        assert self._linked_group_ids(stale) == {moved_group.id}

    def test_does_not_count_rekey_completed_by_another_delivery(self) -> None:
        self.create_integration_external_issue(
            group=self.create_group(), integration=self.integration, key="APP-123"
        )
        self.create_integration_external_issue(
            group=self.create_group(), integration=self.integration, key="PLATFORM-45"
        )
        reconcile_after_conflict = external_issue_key._reconcile_after_conflict

        def complete_in_another_delivery(
            stale_issue: ExternalIssue,
            old_key: str,
            new_key: str,
            provider_issue_id: str | None,
        ) -> tuple[bool, int | None]:
            ExternalIssue.objects.filter(id=stale_issue.id).delete()
            return reconcile_after_conflict(stale_issue, old_key, new_key, provider_issue_id)

        with (
            patch.object(external_issue_key, "_find_survivor", return_value=None),
            patch.object(
                external_issue_key,
                "_reconcile_after_conflict",
                side_effect=complete_in_another_delivery,
            ),
        ):
            assert rekey_external_issues(self.integration, "APP-123", "PLATFORM-45") == 0

    def test_merge_drops_duplicate_group_links(self) -> None:
        # The same group linked to both keys: GroupLink is unique on
        # (group, linked_type, linked_id), so the redundant link is dropped rather than
        # repointed onto a row the group already links to.
        group = self.create_group()
        stale = self.create_integration_external_issue(
            group=group, integration=self.integration, key="APP-123"
        )
        survivor = self.create_integration_external_issue(
            group=group, integration=self.integration, key="PLATFORM-45"
        )

        assert rekey_external_issues(self.integration, "APP-123", "PLATFORM-45") == 1

        assert not ExternalIssue.objects.filter(id=stale.id).exists()
        assert self._linked_group_ids(survivor) == {group.id}
        assert (
            GroupLink.objects.filter(
                group_id=group.id, linked_type=GroupLink.LinkedType.issue
            ).count()
            == 1
        )
