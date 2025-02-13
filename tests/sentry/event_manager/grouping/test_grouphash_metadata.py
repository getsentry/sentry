from __future__ import annotations

from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
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
    def assert_metadata_value(self, grouphash, value_name, value):
        assert grouphash and grouphash.metadata
        assert getattr(grouphash.metadata, value_name) == value

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

        with Feature({"organizations:grouphash-metadata-creation": True}):
            # New hashes get metadata
            event3 = save_new_event({"message": "Adopt, don't shop"}, self.project)
            grouphash = GroupHash.objects.filter(
                project=self.project, hash=event3.get_primary_hash()
            ).first()
            assert grouphash and isinstance(grouphash.metadata, GroupHashMetadata)

            # For now, existing hashes aren't backfiled when new events are assigned to them
            event4 = save_new_event({"message": "Dogs are great!"}, self.project)
            assert event4.get_primary_hash() == event1.get_primary_hash()
            grouphash = GroupHash.objects.filter(
                project=self.project, hash=event4.get_primary_hash()
            ).first()
            assert grouphash and grouphash.metadata is None

    @with_feature("organizations:grouphash-metadata-creation")
    def test_stores_grouping_config(self):
        event = save_new_event({"message": "Dogs are great!"}, self.project)
        grouphash = GroupHash.objects.filter(
            project=self.project, hash=event.get_primary_hash()
        ).first()

        self.assert_metadata_value(grouphash, "latest_grouping_config", DEFAULT_GROUPING_CONFIG)

    @with_feature("organizations:grouphash-metadata-creation")
    @override_options({"grouping.grouphash_metadata.backfill_sample_rate": 1.0})
    def test_updates_grouping_config(self):
        self.project.update_option("sentry:grouping_config", LEGACY_GROUPING_CONFIG)

        event1 = save_new_event({"message": "Dogs are great!"}, self.project)
        grouphash1 = GroupHash.objects.filter(
            project=self.project, hash=event1.get_primary_hash()
        ).first()

        self.assert_metadata_value(grouphash1, "latest_grouping_config", LEGACY_GROUPING_CONFIG)

        # Update the grouping config. Since there's nothing to parameterize in the message, the
        # result should be the same under both configs.
        self.project.update_option("sentry:grouping_config", DEFAULT_GROUPING_CONFIG)

        event2 = save_new_event({"message": "Dogs are great!"}, self.project)
        grouphash2 = GroupHash.objects.filter(
            project=self.project, hash=event2.get_primary_hash()
        ).first()

        self.assert_metadata_value(grouphash2, "latest_grouping_config", DEFAULT_GROUPING_CONFIG)

        # Make sure we're dealing with a single grouphash that got updated rather than two different grouphashes
        assert grouphash1 and grouphash2 and grouphash1.id == grouphash2.id
