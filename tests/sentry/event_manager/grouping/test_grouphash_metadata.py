from __future__ import annotations

from datetime import timedelta
from time import time
from typing import Any
from unittest.mock import ANY, MagicMock, patch

from django.utils import timezone

from sentry.conf.server import DEFAULT_GROUPING_CONFIG
from sentry.grouping.ingest.grouphash_metadata import create_or_update_grouphash_metadata_if_needed
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GROUPHASH_METADATA_SCHEMA_VERSION, HashBasis
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.helpers.options import override_options
from sentry.testutils.skips import requires_snuba
from tests.sentry.grouping import NO_MSG_PARAM_CONFIG

pytestmark = [requires_snuba]


class GroupHashMetadataTest(TestCase):
    # Helper method to save us from having to assert the existence of `grouphash` and
    # `grouphash.metadata` every time we want to check a value
    def assert_metadata_values(self, grouphash: GroupHash | None, values: dict[str, Any]) -> None:
        assert grouphash and grouphash.metadata

        for value_name, value in values.items():
            assert getattr(grouphash.metadata, value_name) == value, (
                f"Incorrect value for {value_name}"
            )

    def test_creates_grouphash_metadata_when_appropriate(self) -> None:
        # The killswitch is obeyed
        with override_options({"grouping.grouphash_metadata.ingestion_writes_enabled": False}):
            event1 = save_new_event({"message": "Dogs are great!"}, self.project)
            grouphash = GroupHash.objects.filter(
                project=self.project, hash=event1.get_primary_hash()
            ).first()
            assert grouphash and grouphash.metadata is None

        with patch("sentry.grouping.ingest.grouphash_metadata.metrics.incr") as mock_metrics_incr:
            # New hashes get metadata
            event2 = save_new_event({"message": "Adopt, don't shop"}, self.project)
            grouphash = GroupHash.objects.filter(
                project=self.project, hash=event2.get_primary_hash()
            ).first()
            assert grouphash and grouphash.metadata
            mock_metrics_incr.assert_any_call(
                "grouping.grouphash_metadata.db_hit", tags={"reason": "new_grouphash"}
            )

            # Existing hashes are backfilled when new events are assigned to them
            event3 = save_new_event({"message": "Dogs are great!"}, self.project)
            assert event3.get_primary_hash() == event1.get_primary_hash()
            grouphash = GroupHash.objects.filter(
                project=self.project, hash=event3.get_primary_hash()
            ).first()
            assert grouphash and grouphash.metadata
            mock_metrics_incr.assert_any_call(
                "grouping.grouphash_metadata.db_hit", tags={"reason": "missing_metadata"}
            )
            # For grouphashes created before we started collecting metadata, we don't know
            # creation date
            assert grouphash.metadata.date_added is None

    def test_stores_expected_properties(self) -> None:
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

    def test_stores_expected_properties_for_secondary_hashes(self) -> None:
        project = self.project

        project.update_option("sentry:grouping_config", NO_MSG_PARAM_CONFIG)

        # Ensure the older grouphash doesn't have metadata added when it's created as the primary
        # grouphash, so we can test how the metadata code handles it when that same grouphash comes
        # up as a secondary grouphash
        with override_options({"grouping.grouphash_metadata.ingestion_writes_enabled": False}):
            event1 = save_new_event(
                {"message": "Dogs are great! 1231", "platform": "python"}, self.project
            )
            older_config_grouphash = GroupHash.objects.filter(
                project=self.project, hash=event1.get_primary_hash()
            ).first()
            assert older_config_grouphash and not older_config_grouphash.metadata

        # Update the project's grouping config, and set it in transition mode
        project.update_option("sentry:grouping_config", DEFAULT_GROUPING_CONFIG)
        project.update_option("sentry:secondary_grouping_config", NO_MSG_PARAM_CONFIG)
        project.update_option("sentry:secondary_grouping_expiry", time() + 3600)

        event2 = save_new_event(
            {"message": "Dogs are great! 1231", "platform": "python"}, self.project
        )
        default_config_grouphash = GroupHash.objects.filter(
            project=self.project, hash=event2.get_primary_hash()
        ).first()
        # The events should end up in the same group, but their hashes should be different (because
        # NO_MSG_PARAM_CONFIG won't parameterize the number in the message, while the default config
        # will)
        assert event1.group_id == event2.group_id
        assert (
            default_config_grouphash
            and default_config_grouphash.hash != older_config_grouphash.hash
        )

        # This time metadata was added
        older_config_grouphash.refresh_from_db()
        assert older_config_grouphash.metadata
        self.assert_metadata_values(
            older_config_grouphash,
            {
                "schema_version": GROUPHASH_METADATA_SCHEMA_VERSION,
                "latest_grouping_config": NO_MSG_PARAM_CONFIG,
                "platform": "python",
            },
        )
        # No hash basis or hashing metadata because secondary grouphashes don't come with variants
        assert older_config_grouphash.metadata.hash_basis is None
        assert older_config_grouphash.metadata.hashing_metadata is None

    @patch("sentry.grouping.ingest.grouphash_metadata.metrics.incr")
    def test_does_grouping_config_update(self, mock_metrics_incr: MagicMock) -> None:
        self.project.update_option("sentry:grouping_config", NO_MSG_PARAM_CONFIG)

        event1 = save_new_event({"message": "Dogs are great!"}, self.project)
        grouphash1 = GroupHash.objects.filter(
            project=self.project, hash=event1.get_primary_hash()
        ).first()

        self.assert_metadata_values(grouphash1, {"latest_grouping_config": NO_MSG_PARAM_CONFIG})

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
                "current_config": NO_MSG_PARAM_CONFIG,
                "new_config": DEFAULT_GROUPING_CONFIG,
            },
        )

    @patch("sentry.grouping.ingest.grouphash_metadata.metrics.incr")
    def test_does_schema_update(self, mock_metrics_incr: MagicMock) -> None:
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

    @patch("sentry.grouping.ingest.grouphash_metadata.metrics.incr")
    def test_does_both_updates(self, mock_metrics_incr: MagicMock) -> None:
        self.project.update_option("sentry:grouping_config", NO_MSG_PARAM_CONFIG)

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
                    "latest_grouping_config": NO_MSG_PARAM_CONFIG,
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
                    "current_config": NO_MSG_PARAM_CONFIG,
                    "new_config": DEFAULT_GROUPING_CONFIG,
                    "current_version": "11",
                    "new_version": "12",
                },
            )

    @patch("sentry.grouping.ingest.grouphash_metadata.metrics.incr")
    def test_grouping_config_update_precedence(self, mock_metrics_incr: MagicMock) -> None:
        """
        Test that we don't overwrite a newer config with an older one, or with None.
        """

        oldest_config = "charliestyle:2012-11-21"
        older_config = "maiseystyle:2012-12-31"
        new_config = "adoptdontshopstyle:2013-09-08"

        event = Event(
            event_id="12312012041520130908201311212012",
            project_id=self.project.id,
            data={"message": "Dogs are great!"},
        )

        grouphash = GroupHash.objects.create(project_id=self.project.id, hash="20130415")
        create_or_update_grouphash_metadata_if_needed(event, self.project, grouphash, False, "", {})
        assert grouphash.metadata

        for (
            current_latest_config,
            incoming_grouping_config,
            expected_end_value,
            should_expect_metrics_call,  # True whenever config has been updated
        ) in [
            (None, oldest_config, oldest_config, True),
            (None, older_config, older_config, True),
            (None, new_config, new_config, True),
            (oldest_config, None, oldest_config, False),
            (oldest_config, older_config, older_config, True),
            (oldest_config, new_config, new_config, True),
            (older_config, None, older_config, False),
            (older_config, oldest_config, older_config, False),
            (older_config, new_config, new_config, True),
            (new_config, None, new_config, False),
            (new_config, oldest_config, new_config, False),
            (new_config, older_config, new_config, False),
        ]:
            # Set initial state
            grouphash.metadata.update(latest_grouping_config=current_latest_config)
            assert grouphash.metadata.latest_grouping_config == current_latest_config

            create_or_update_grouphash_metadata_if_needed(
                event,
                self.project,
                grouphash,
                False,
                incoming_grouping_config,  # type: ignore[arg-type] # intentionally bad data
                {},
            )
            assert grouphash.metadata.latest_grouping_config == expected_end_value

            if should_expect_metrics_call:
                mock_metrics_incr.assert_any_call(
                    "grouping.grouphash_metadata.db_hit",
                    tags={
                        "reason": "old_grouping_config",
                        "current_config": current_latest_config,
                        "new_config": expected_end_value,
                    },
                )

            mock_metrics_incr.reset_mock()

    def test_updates_event_id_when_date_updated_older_than_90_days(self) -> None:
        """Test that event_id is updated when date_updated is older than 90 days."""

        # Create an event and grouphash with metadata
        event1 = save_new_event({"message": "Dogs are great!"}, self.project)
        grouphash = GroupHash.objects.filter(
            project=self.project, hash=event1.get_primary_hash()
        ).first()
        assert grouphash and grouphash.metadata

        # Set the date_updated to be older than 90 days
        old_date = timezone.now() - timedelta(days=91)
        grouphash.metadata.update(date_updated=old_date)

        # Create a new event with the same hash
        event2 = save_new_event({"message": "Dogs are great!"}, self.project)
        assert event2.get_primary_hash() == event1.get_primary_hash()

        # Refresh the grouphash to get updated metadata
        grouphash.refresh_from_db()

        # Verify that the event_id was updated to the new event's ID
        assert grouphash.metadata.event_id == event2.event_id
        # Verify that date_updated was also updated
        assert grouphash.metadata.date_updated and grouphash.metadata.date_updated > old_date

    def test_does_not_update_event_id_when_date_updated_newer_than_90_days(self) -> None:
        """Test that event_id is not updated when date_updated is newwer than 90 days."""

        # Create an event and grouphash with metadata
        event1 = save_new_event({"message": "Dogs are great!"}, self.project)
        grouphash = GroupHash.objects.filter(
            project=self.project, hash=event1.get_primary_hash()
        ).first()
        assert grouphash and grouphash.metadata
        current_date_updated = grouphash.metadata.date_updated

        # Create a new event with the same hash
        event2 = save_new_event({"message": "Dogs are great!"}, self.project)
        assert event2.get_primary_hash() == event1.get_primary_hash()

        # Refresh the grouphash to get updated metadata
        grouphash.refresh_from_db()

        # Verify that neither the event_id or the update timestamp were changed
        assert grouphash.metadata.event_id == event1.event_id
        assert grouphash.metadata.date_updated == current_date_updated
