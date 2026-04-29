from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from sentry.eventstore import backend as eventstore
from sentry.models.group import DEFAULT_TYPE_ID
from sentry.tasks.seer.backfill_supergroups_lightweight import (
    backfill_supergroups_lightweight_for_org,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.types.group import GroupSubStatus
from sentry.utils.snuba import SnubaError

TEST_BATCH_SIZE = 5


class BackfillSupergroupsLightweightForOrgTest(TestCase):
    def setUp(self):
        super().setUp()
        self.event = self.store_event(
            data={"message": "test error", "level": "error"},
            project_id=self.project.id,
        )
        self.group = self.event.group
        self.group.substatus = GroupSubStatus.NEW
        self.group.save(update_fields=["substatus"])

    @with_feature("organizations:supergroups-lightweight-rca-clustering-write")
    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    def test_processes_groups_and_sends_to_seer(self, mock_request):
        mock_request.return_value = MagicMock(status=200)

        backfill_supergroups_lightweight_for_org(self.organization.id)

        mock_request.assert_called_once()
        body = mock_request.call_args.args[0]
        assert body["group_id"] == self.group.id
        assert body["project_id"] == self.project.id
        assert body["organization_id"] == self.organization.id
        assert body["issue"]["id"] == self.group.id
        assert len(body["issue"]["events"]) == 1

    @with_feature("organizations:supergroups-lightweight-rca-clustering-write")
    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    def test_moves_to_next_project_after_current_exhausted(self, mock_request):
        """After finishing one project's groups, chains to the next project."""
        mock_request.return_value = MagicMock(status=200)

        project2 = self.create_project(organization=self.organization)
        event2 = self.store_event(
            data={"message": "error in project2", "level": "error"},
            project_id=project2.id,
        )
        assert event2.group is not None
        event2.group.substatus = GroupSubStatus.NEW
        event2.group.save(update_fields=["substatus"])

        # First call processes first project's groups
        with patch(
            "sentry.tasks.seer.backfill_supergroups_lightweight.backfill_supergroups_lightweight_for_org.apply_async"
        ) as mock_chain:
            backfill_supergroups_lightweight_for_org(self.organization.id)

            # Should chain to next project
            mock_chain.assert_called_once()
            next_kwargs = mock_chain.call_args.kwargs["kwargs"]
            assert next_kwargs["last_group_id"] == 0

        # Second call processes second project's groups
        mock_request.reset_mock()
        backfill_supergroups_lightweight_for_org(self.organization.id, **next_kwargs)
        mock_request.assert_called_once()
        assert mock_request.call_args.args[0]["project_id"] == project2.id

    @with_feature("organizations:supergroups-lightweight-rca-clustering-write")
    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    def test_self_chains_when_more_groups_exist(self, mock_request):
        mock_request.return_value = MagicMock(status=200)

        # Create enough groups to fill a batch
        for i in range(TEST_BATCH_SIZE):
            evt = self.store_event(
                data={
                    "message": f"error {i}",
                    "level": "error",
                    "fingerprint": [f"group-{i}"],
                },
                project_id=self.project.id,
            )
            assert evt.group is not None
            evt.group.substatus = GroupSubStatus.NEW
            evt.group.save(update_fields=["substatus"])

        with (
            self.options({"seer.supergroups_backfill_lightweight.batch_size": TEST_BATCH_SIZE}),
            patch(
                "sentry.tasks.seer.backfill_supergroups_lightweight.backfill_supergroups_lightweight_for_org.apply_async"
            ) as mock_chain,
        ):
            backfill_supergroups_lightweight_for_org(self.organization.id)

            mock_chain.assert_called_once()
            call_kwargs = mock_chain.call_args.kwargs["kwargs"]
            # Should stay on the same project with a group cursor
            assert call_kwargs["last_project_id"] == self.project.id
            assert call_kwargs["last_group_id"] > 0

    @with_feature("organizations:supergroups-lightweight-rca-clustering-write")
    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    def test_completes_when_no_more_projects(self, mock_request):
        """When all projects are exhausted, the task completes without chaining."""
        mock_request.return_value = MagicMock(status=200)

        with patch(
            "sentry.tasks.seer.backfill_supergroups_lightweight.backfill_supergroups_lightweight_for_org.apply_async"
        ) as mock_chain:
            # Pass a project ID higher than any real project
            backfill_supergroups_lightweight_for_org(
                self.organization.id,
                last_project_id=self.project.id + 9999,
            )

            mock_request.assert_not_called()
            mock_chain.assert_not_called()

    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    def test_respects_killswitch(self, mock_request):
        with self.options({"seer.supergroups_backfill_lightweight.killswitch": True}):
            backfill_supergroups_lightweight_for_org(self.organization.id)

        mock_request.assert_not_called()

    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    def test_skips_without_feature_flag(self, mock_request):
        backfill_supergroups_lightweight_for_org(self.organization.id)

        mock_request.assert_not_called()

    @with_feature("organizations:supergroups-lightweight-rca-clustering-write")
    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    def test_continues_on_individual_group_failure(self, mock_request):
        event2 = self.store_event(
            data={"message": "second error", "level": "error", "fingerprint": ["group2"]},
            project_id=self.project.id,
        )
        assert event2.group is not None
        event2.group.substatus = GroupSubStatus.NEW
        event2.group.save(update_fields=["substatus"])

        mock_request.side_effect = [
            MagicMock(status=500),
            MagicMock(status=200),
        ]

        backfill_supergroups_lightweight_for_org(self.organization.id)

        assert mock_request.call_count == 2

    @with_feature("organizations:supergroups-lightweight-rca-clustering-write")
    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    @patch("sentry.tasks.seer.backfill_supergroups_lightweight.bulk_snuba_queries")
    def test_skips_old_groups_with_no_events(self, mock_snuba, mock_request):
        """Groups inside the age window but with no Snuba events are skipped."""
        # Inside the 90-day DB cutoff so the group reaches Snuba; this exercises
        # the secondary skip path (e.g. events aged out of Snuba retention).
        self.group.last_seen = datetime.now(UTC) - timedelta(days=30)
        self.group.save(update_fields=["last_seen"])

        mock_snuba.return_value = [{"data": []}]

        backfill_supergroups_lightweight_for_org(self.organization.id)

        mock_request.assert_not_called()

    @with_feature("organizations:supergroups-lightweight-rca-clustering-write")
    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    @patch("sentry.tasks.seer.backfill_supergroups_lightweight.bulk_snuba_queries")
    def test_skips_groups_older_than_max_age(self, mock_snuba, mock_request):
        self.group.last_seen = datetime.now(UTC) - timedelta(days=91)
        self.group.save(update_fields=["last_seen"])

        backfill_supergroups_lightweight_for_org(self.organization.id)

        # DB-level filter — Snuba is never queried for stale groups.
        mock_snuba.assert_not_called()
        mock_request.assert_not_called()

    @with_feature("organizations:supergroups-lightweight-rca-clustering-write")
    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    def test_processes_groups_within_max_age(self, mock_request):
        mock_request.return_value = MagicMock(status=200)
        self.group.last_seen = datetime.now(UTC) - timedelta(days=89)
        self.group.save(update_fields=["last_seen"])

        backfill_supergroups_lightweight_for_org(self.organization.id)

        mock_request.assert_called_once()

    @with_feature("organizations:supergroups-lightweight-rca-clustering-write")
    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    def test_skips_security_report_event_types(self, mock_request):
        mock_request.return_value = MagicMock(status=200)

        # Bind real node data, then stamp the event as a security report so the
        # task's get_event_type() check trips. Avoids fighting Relay
        # normalization to mint a real CSP fixture in the test.
        original_bind = eventstore.bind_nodes

        def bind_and_mark_csp(events):
            original_bind(events)
            for event in events:
                if event.data:
                    event.data["type"] = "csp"

        with patch(
            "sentry.tasks.seer.backfill_supergroups_lightweight.eventstore.bind_nodes",
            side_effect=bind_and_mark_csp,
        ):
            backfill_supergroups_lightweight_for_org(self.organization.id)

        mock_request.assert_not_called()

    @with_feature("organizations:supergroups-lightweight-rca-clustering-write")
    @patch("sentry.utils.retries.time.sleep")
    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    @patch("sentry.tasks.seer.backfill_supergroups_lightweight.bulk_snuba_queries")
    def test_retries_snuba_query_on_failure(self, mock_snuba, mock_request, mock_sleep):
        mock_request.return_value = MagicMock(status=200)
        mock_snuba.side_effect = [
            SnubaError("transient"),
            SnubaError("transient"),
            [{"data": [{"event_id": self.event.event_id}]}],
        ]

        backfill_supergroups_lightweight_for_org(self.organization.id)

        assert mock_snuba.call_count == 3

    @with_feature("organizations:supergroups-lightweight-rca-clustering-write")
    @patch("sentry.utils.retries.time.sleep")
    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    @patch("sentry.tasks.seer.backfill_supergroups_lightweight.bulk_snuba_queries")
    def test_raises_after_snuba_retries_exhausted(self, mock_snuba, mock_request, mock_sleep):
        mock_snuba.side_effect = SnubaError("persistent")

        with pytest.raises(SnubaError):
            backfill_supergroups_lightweight_for_org(self.organization.id)

        assert mock_snuba.call_count == 3
        mock_request.assert_not_called()

    @with_feature("organizations:supergroups-lightweight-rca-clustering-write")
    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    def test_skips_non_error_groups(self, mock_request):
        self.group.type = DEFAULT_TYPE_ID + 1
        self.group.save(update_fields=["type"])

        backfill_supergroups_lightweight_for_org(self.organization.id)

        mock_request.assert_not_called()

    @with_feature("organizations:supergroups-lightweight-rca-clustering-write")
    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    def test_resumes_from_cursor(self, mock_request):
        mock_request.return_value = MagicMock(status=200)

        event2 = self.store_event(
            data={"message": "second error", "level": "error", "fingerprint": ["group2"]},
            project_id=self.project.id,
        )
        assert event2.group is not None
        event2.group.substatus = GroupSubStatus.NEW
        event2.group.save(update_fields=["substatus"])

        # Resume from cursor pointing at the first group — should only process the second
        backfill_supergroups_lightweight_for_org(
            self.organization.id,
            last_project_id=self.project.id,
            last_group_id=self.group.id,
        )

        mock_request.assert_called_once()
        assert mock_request.call_args.args[0]["group_id"] == event2.group.id

    @with_feature("organizations:supergroups-lightweight-rca-clustering-write")
    @patch(
        "sentry.tasks.seer.backfill_supergroups_lightweight.make_lightweight_rca_cluster_request"
    )
    def test_chains_then_completes_on_exact_batch_boundary(self, mock_request):
        mock_request.return_value = MagicMock(status=200)

        # Create exactly TEST_BATCH_SIZE groups total (setUp already created 1)
        for i in range(TEST_BATCH_SIZE - 1):
            evt = self.store_event(
                data={
                    "message": f"error {i}",
                    "level": "error",
                    "fingerprint": [f"boundary-{i}"],
                },
                project_id=self.project.id,
            )
            assert evt.group is not None
            evt.group.substatus = GroupSubStatus.NEW
            evt.group.save(update_fields=["substatus"])

        # First call: full batch, chains with same project and group cursor
        with (
            self.options({"seer.supergroups_backfill_lightweight.batch_size": TEST_BATCH_SIZE}),
            patch(
                "sentry.tasks.seer.backfill_supergroups_lightweight.backfill_supergroups_lightweight_for_org.apply_async"
            ) as mock_chain,
        ):
            backfill_supergroups_lightweight_for_org(self.organization.id)
            mock_chain.assert_called_once()
            next_kwargs = mock_chain.call_args.kwargs["kwargs"]
            assert next_kwargs["last_project_id"] == self.project.id
            assert next_kwargs["last_group_id"] > 0

        # Second call: no groups left in project, chains to next project
        mock_request.reset_mock()
        with (
            self.options({"seer.supergroups_backfill_lightweight.batch_size": TEST_BATCH_SIZE}),
            patch(
                "sentry.tasks.seer.backfill_supergroups_lightweight.backfill_supergroups_lightweight_for_org.apply_async"
            ) as mock_chain,
        ):
            backfill_supergroups_lightweight_for_org(self.organization.id, **next_kwargs)
            mock_request.assert_not_called()
            mock_chain.assert_called_once()
            final_kwargs = mock_chain.call_args.kwargs["kwargs"]
            assert final_kwargs["last_group_id"] == 0

        # Third call: no more projects, completes
        mock_request.reset_mock()
        with patch(
            "sentry.tasks.seer.backfill_supergroups_lightweight.backfill_supergroups_lightweight_for_org.apply_async"
        ) as mock_chain:
            backfill_supergroups_lightweight_for_org(self.organization.id, **final_kwargs)
            mock_request.assert_not_called()
            mock_chain.assert_not_called()
