from __future__ import annotations

from typing import Any
from unittest.mock import ANY, MagicMock, patch

from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata, HashBasis
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG, LEGACY_GROUPING_CONFIG
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class GroupHashMetadataTest(TestCase):
    # Helper method to save us from having to assert the existence of `grouphash` and
    # `grouphash.metadata` every time we want to check a value
    def assert_metadata_values(self, grouphash: GroupHash | None, values: dict[str, Any]) -> None:
        assert grouphash and grouphash.metadata

        for value_name, value in values.items():
            assert (
                getattr(grouphash.metadata, value_name) == value
            ), f"Incorrect value for {value_name}"

    def test_creates_grouphash_metadata_when_appropriate(self):
        # The killswitch is obeyed
        with override_options({"grouping.grouphash_metadata.ingestion_writes_enabled": False}):
            event1 = save_new_event({"message": "Dogs are great!"}, self.project)
            grouphash = GroupHash.objects.filter(
                project=self.project, hash=event1.get_primary_hash()
            ).first()
            assert grouphash and grouphash.metadata is None

        # The feature flag is obeyed
        with Feature({"organizations:grouphash-metadata-creation": False}):
            event2 = save_new_event({"message": "Sit! Good dog!"}, self.project)
            grouphash = GroupHash.objects.filter(
                project=self.project, hash=event2.get_primary_hash()
            ).first()
            assert grouphash and grouphash.metadata is None

        with (
            Feature({"organizations:grouphash-metadata-creation": True}),
            patch("sentry.grouping.ingest.grouphash_metadata.metrics.incr") as mock_metrics_incr,
        ):
            # New hashes get metadata
            event3 = save_new_event({"message": "Adopt, don't shop"}, self.project)
            grouphash = GroupHash.objects.filter(
                project=self.project, hash=event3.get_primary_hash()
            ).first()
            assert grouphash and isinstance(grouphash.metadata, GroupHashMetadata)
            mock_metrics_incr.assert_any_call(
                "grouping.grouphash_metadata.db_hit", tags={"reason": "new_grouphash"}
            )

            # For now, existing hashes aren't backfiled when new events are assigned to them
            event4 = save_new_event({"message": "Dogs are great!"}, self.project)
            assert event4.get_primary_hash() == event1.get_primary_hash()
            grouphash = GroupHash.objects.filter(
                project=self.project, hash=event4.get_primary_hash()
            ).first()
            assert grouphash and grouphash.metadata is None

    @with_feature("organizations:grouphash-metadata-creation")
    def test_stores_expected_properties(self):
        event = save_new_event({"message": "Dogs are great!", "platform": "python"}, self.project)
        grouphash = GroupHash.objects.filter(
            project=self.project, hash=event.get_primary_hash()
        ).first()

        self.assert_metadata_values(
            grouphash,
            {
                "latest_grouping_config": DEFAULT_GROUPING_CONFIG,
                "hash_basis": HashBasis.MESSAGE,
                "hashing_metadata": ANY,  # Tested extensively with snapshots
                "platform": "python",
            },
        )

    @with_feature("organizations:grouphash-metadata-creation")
    @override_options({"grouping.grouphash_metadata.backfill_sample_rate": 1.0})
    @patch("sentry.grouping.ingest.grouphash_metadata.metrics.incr")
    def test_does_grouping_config_update(self, mock_metrics_incr: MagicMock):
        self.project.update_option("sentry:grouping_config", LEGACY_GROUPING_CONFIG)

        event1 = save_new_event({"message": "Dogs are great!"}, self.project)
        grouphash1 = GroupHash.objects.filter(
            project=self.project, hash=event1.get_primary_hash()
        ).first()

        self.assert_metadata_values(grouphash1, {"latest_grouping_config": LEGACY_GROUPING_CONFIG})

        # Update the grouping config. Since there's nothing to parameterize in the message, the
        # hash should be the same under both configs, meaning we'll hit the same grouphash.
        self.project.update_option("sentry:grouping_config", DEFAULT_GROUPING_CONFIG)

        event2 = save_new_event({"message": "Dogs are great!"}, self.project)
        grouphash2 = GroupHash.objects.filter(
            project=self.project, hash=event2.get_primary_hash()
        ).first()

        # Make sure we're dealing with the same grouphash
        assert grouphash1 == grouphash2

        self.assert_metadata_values(grouphash2, {"latest_grouping_config": DEFAULT_GROUPING_CONFIG})

        mock_metrics_incr.assert_any_call(
            "grouping.grouphash_metadata.db_hit",
            tags={
                "reason": "old_grouping_config",
                "current_config": LEGACY_GROUPING_CONFIG,
                "new_config": DEFAULT_GROUPING_CONFIG,
            },
        )
