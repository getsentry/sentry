from __future__ import annotations

from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.helpers.options import override_options
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class GroupHashMetadataTest(TestCase):
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
