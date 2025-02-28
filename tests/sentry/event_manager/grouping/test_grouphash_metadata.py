from __future__ import annotations

from typing import Any
from unittest.mock import ANY, MagicMock, patch

from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GROUPHASH_METADATA_SCHEMA_VERSION, HashBasis
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
            assert grouphash and grouphash.metadata
            mock_metrics_incr.assert_any_call(
                "grouping.grouphash_metadata.db_hit", tags={"reason": "new_grouphash"}
            )

            # Existing hashes are backfiled when new events are assigned to them, according to the
            # sample rate
            with override_options({"grouping.grouphash_metadata.backfill_sample_rate": 0.415}):
                # Over the sample rate cutoff, so no record created
                with patch(
                    "sentry.grouping.ingest.grouphash_metadata.random.random", return_value=0.908
                ):
                    event4 = save_new_event({"message": "Dogs are great!"}, self.project)
                    assert event4.get_primary_hash() == event1.get_primary_hash()
                    grouphash = GroupHash.objects.filter(
                        project=self.project, hash=event4.get_primary_hash()
                    ).first()
                    assert grouphash and grouphash.metadata is None

                # Under the sample rate cutoff, so record will be created
                with patch(
                    "sentry.grouping.ingest.grouphash_metadata.random.random", return_value=0.1231
                ):
                    event5 = save_new_event({"message": "Dogs are great!"}, self.project)
                    assert event5.get_primary_hash() == event1.get_primary_hash()
                    grouphash = GroupHash.objects.filter(
                        project=self.project, hash=event5.get_primary_hash()
                    ).first()
                    assert grouphash and grouphash.metadata
                    mock_metrics_incr.assert_any_call(
                        "grouping.grouphash_metadata.db_hit", tags={"reason": "missing_metadata"}
                    )
                    # For grouphashes created before we started collecting metadata, we don't know
                    # creation date
                    assert grouphash.metadata.date_added is None

    @with_feature("organizations:grouphash-metadata-creation")
    def test_stores_expected_properties(self):
        event = save_new_event({"message": "Dogs are great!", "platform": "python"}, self.project)
        grouphash = GroupHash.objects.filter(
            project=self.project, hash=event.get_primary_hash()
        ).first()

        self.assert_metadata_values(
            grouphash,
            {
                "schema_version": GROUPHASH_METADATA_SCHEMA_VERSION,
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

    @with_feature("organizations:grouphash-metadata-creation")
    @override_options({"grouping.grouphash_metadata.backfill_sample_rate": 0.415})
    def test_updates_obey_sample_rate(self):
        self.project.update_option("sentry:grouping_config", LEGACY_GROUPING_CONFIG)

        event1 = save_new_event({"message": "Dogs are great!"}, self.project)
        grouphash1 = GroupHash.objects.filter(
            project=self.project, hash=event1.get_primary_hash()
        ).first()

        self.assert_metadata_values(grouphash1, {"latest_grouping_config": LEGACY_GROUPING_CONFIG})

        # Update the grouping config. Since there's nothing to parameterize in the message, the
        # hash should be the same under both configs, meaning we'll hit the same grouphash.
        self.project.update_option("sentry:grouping_config", DEFAULT_GROUPING_CONFIG)

        # Over the sample rate cutoff, so no update should happen
        with patch("sentry.grouping.ingest.grouphash_metadata.random.random", return_value=0.908):
            event2 = save_new_event({"message": "Dogs are great!"}, self.project)
            grouphash2 = GroupHash.objects.filter(
                project=self.project, hash=event2.get_primary_hash()
            ).first()

            # Make sure we're dealing with the same grouphash
            assert grouphash1 == grouphash2

            # Grouping config wasn't updated
            self.assert_metadata_values(
                grouphash2, {"latest_grouping_config": LEGACY_GROUPING_CONFIG}
            )

        # Under the sample rate cutoff, so record should be updated
        with patch("sentry.grouping.ingest.grouphash_metadata.random.random", return_value=0.1231):
            event3 = save_new_event({"message": "Dogs are great!"}, self.project)
            grouphash3 = GroupHash.objects.filter(
                project=self.project, hash=event3.get_primary_hash()
            ).first()

            # Make sure we're dealing with the same grouphash
            assert grouphash1 == grouphash3

            # Grouping config was updated
            self.assert_metadata_values(
                grouphash3, {"latest_grouping_config": DEFAULT_GROUPING_CONFIG}
            )

    @with_feature("organizations:grouphash-metadata-creation")
    @override_options({"grouping.grouphash_metadata.backfill_sample_rate": 1.0})
    @patch("sentry.grouping.ingest.grouphash_metadata.metrics.incr")
    def test_does_schema_update(self, mock_metrics_incr: MagicMock):
        with patch(
            "sentry.grouping.ingest.grouphash_metadata.GROUPHASH_METADATA_SCHEMA_VERSION", "11"
        ):
            event1 = save_new_event({"message": "Dogs are great!"}, self.project)
            grouphash1 = GroupHash.objects.filter(
                project=self.project, hash=event1.get_primary_hash()
            ).first()

            self.assert_metadata_values(
                grouphash1,
                {
                    "schema_version": "11",
                    "hashing_metadata": {
                        "message_source": "message",
                        "message_parameterized": False,
                    },
                },
            )

        # Update the schema by incrementing the version and changing what data is stored.
        with (
            patch(
                "sentry.grouping.ingest.grouphash_metadata.GROUPHASH_METADATA_SCHEMA_VERSION", "12"
            ),
            patch(
                "sentry.grouping.ingest.grouphash_metadata._get_message_hashing_metadata",
                return_value={"something": "different"},
            ),
        ):

            event2 = save_new_event({"message": "Dogs are great!"}, self.project)
            grouphash2 = GroupHash.objects.filter(
                project=self.project, hash=event2.get_primary_hash()
            ).first()

            # Make sure we're dealing with the same grouphash
            assert grouphash1 == grouphash2

            self.assert_metadata_values(
                grouphash2,
                {
                    "schema_version": "12",
                    "hashing_metadata": {"something": "different"},
                },
            )

            mock_metrics_incr.assert_any_call(
                "grouping.grouphash_metadata.db_hit",
                tags={
                    "reason": "outdated_schema",
                    "current_version": "11",
                    "new_version": "12",
                },
            )

    @with_feature("organizations:grouphash-metadata-creation")
    @override_options({"grouping.grouphash_metadata.backfill_sample_rate": 1.0})
    @patch("sentry.grouping.ingest.grouphash_metadata.metrics.incr")
    def test_does_both_updates(self, mock_metrics_incr: MagicMock):
        self.project.update_option("sentry:grouping_config", LEGACY_GROUPING_CONFIG)

        with patch(
            "sentry.grouping.ingest.grouphash_metadata.GROUPHASH_METADATA_SCHEMA_VERSION", "11"
        ):
            event1 = save_new_event({"message": "Dogs are great!"}, self.project)
            grouphash1 = GroupHash.objects.filter(
                project=self.project, hash=event1.get_primary_hash()
            ).first()

            self.assert_metadata_values(
                grouphash1,
                {
                    "latest_grouping_config": LEGACY_GROUPING_CONFIG,
                    "schema_version": "11",
                    "hashing_metadata": {
                        "message_source": "message",
                        "message_parameterized": False,
                    },
                },
            )

        # Update the grouping config. Since there's nothing to parameterize in the message, the
        # hash should be the same under both configs, meaning we'll hit the same grouphash.
        self.project.update_option("sentry:grouping_config", DEFAULT_GROUPING_CONFIG)

        # Update the schema by incrementing the version and changing what data is stored.
        with (
            patch(
                "sentry.grouping.ingest.grouphash_metadata.GROUPHASH_METADATA_SCHEMA_VERSION", "12"
            ),
            patch(
                "sentry.grouping.ingest.grouphash_metadata._get_message_hashing_metadata",
                return_value={"something": "different"},
            ),
        ):

            event2 = save_new_event({"message": "Dogs are great!"}, self.project)
            grouphash2 = GroupHash.objects.filter(
                project=self.project, hash=event2.get_primary_hash()
            ).first()

            # Make sure we're dealing with the same grouphash
            assert grouphash1 == grouphash2

            self.assert_metadata_values(
                grouphash2,
                {
                    "latest_grouping_config": DEFAULT_GROUPING_CONFIG,
                    "schema_version": "12",
                    "hashing_metadata": {"something": "different"},
                },
            )

            mock_metrics_incr.assert_any_call(
                "grouping.grouphash_metadata.db_hit",
                tags={
                    "reason": "config_and_schema",
                    "current_config": LEGACY_GROUPING_CONFIG,
                    "new_config": DEFAULT_GROUPING_CONFIG,
                    "current_version": "11",
                    "new_version": "12",
                },
            )
