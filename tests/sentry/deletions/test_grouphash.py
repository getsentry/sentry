from dataclasses import asdict
from unittest.mock import patch

from sentry.conf.server import SEER_SIMILARITY_MODEL_VERSION
from sentry.deletions.tasks.groups import delete_groups
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
from sentry.seer.similarity.types import SeerSimilarIssueData
from sentry.tasks.unmerge import unmerge
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@apply_feature_flag_on_cls("organizations:grouphash-metadata-creation")
class DeleteGroupHashTest(TestCase):
    def test_deleting_group_deletes_grouphash_and_metadata(self):
        event = self.store_event(data={"message": "Dogs are great!"}, project_id=self.project.id)
        assert event.group
        group_id = event.group.id

        grouphash = GroupHash.objects.filter(group_id=group_id).first()
        assert grouphash

        grouphash_metadata = GroupHashMetadata.objects.filter(grouphash_id=grouphash.id).first()
        assert grouphash_metadata

        with self.tasks():
            delete_groups(object_ids=[group_id])

        assert not Group.objects.filter(id=group_id).exists()
        assert not GroupHash.objects.filter(group_id=group_id).exists()
        assert not GroupHashMetadata.objects.filter(grouphash_id=grouphash.id).exists()

    def test_deleting_grouphash_matched_by_seer(self):
        existing_event = self.store_event(
            data={"message": "Dogs are great!"}, project_id=self.project.id
        )
        assert existing_event.group
        existing_group_id = existing_event.group.id

        existing_grouphash = GroupHash.objects.filter(group_id=existing_group_id).first()
        assert existing_grouphash

        seer_result_data = SeerSimilarIssueData(
            parent_hash=existing_event.get_primary_hash(),
            parent_group_id=existing_group_id,
            stacktrace_distance=0.01,
            should_group=True,
        )

        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True),
            patch(
                "sentry.grouping.ingest.seer.get_seer_similar_issues",
                return_value=(
                    {
                        "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                        "results": [asdict(seer_result_data)],
                    },
                    existing_grouphash,
                ),
            ),
        ):
            new_event = self.store_event(
                data={"message": "Adopt, don't shop"}, project_id=self.project.id
            )
            new_grouphash = GroupHash.objects.filter(hash=new_event.get_primary_hash()).first()
            assert new_grouphash and new_grouphash.metadata

            assert new_grouphash != existing_grouphash
            assert new_event.group_id == existing_group_id
            assert new_grouphash.metadata.seer_matched_grouphash == existing_grouphash

        with self.tasks():
            delete_groups(object_ids=[existing_group_id])

        assert not Group.objects.filter(id=existing_group_id).exists()
        assert not GroupHash.objects.filter(group_id=existing_group_id).exists()
        assert not GroupHashMetadata.objects.filter(grouphash_id=existing_grouphash.id).exists()
        assert not GroupHashMetadata.objects.filter(grouphash_id=new_grouphash.id).exists()

    def test_deleting_grouphash_matched_by_seer_after_unmerge(self):
        """
        Ensure that `seer_matched_grouphash` references aren't left dangling (and causing integrity
        errors) when the matched grouphash is deleted.
        """
        existing_event = self.store_event(
            data={"message": "Dogs are great!"}, project_id=self.project.id
        )
        assert existing_event.group

        existing_grouphash = GroupHash.objects.filter(
            hash=existing_event.get_primary_hash()
        ).first()
        assert existing_grouphash

        seer_result_data = SeerSimilarIssueData(
            parent_hash=existing_event.get_primary_hash(),
            parent_group_id=existing_event.group.id,
            stacktrace_distance=0.01,
            should_group=True,
        )

        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True),
            patch(
                "sentry.grouping.ingest.seer.get_seer_similar_issues",
                return_value=(
                    {
                        "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                        "results": [asdict(seer_result_data)],
                    },
                    existing_grouphash,
                ),
            ),
        ):
            new_event = self.store_event(
                data={"message": "Adopt, don't shop"}, project_id=self.project.id
            )
            new_grouphash = GroupHash.objects.filter(hash=new_event.get_primary_hash()).first()
            assert new_grouphash and new_grouphash.metadata

            assert new_grouphash != existing_grouphash
            assert new_event.group_id == existing_event.group.id
            assert new_grouphash.metadata.seer_matched_grouphash == existing_grouphash

        with self.tasks():
            unmerge.delay(
                self.project.id,
                existing_event.group.id,
                None,
                [new_grouphash.hash],
                None,
            )

        # Pull the grouphashes from the DB again to check updated values
        existing_grouphash = GroupHash.objects.filter(
            hash=existing_event.get_primary_hash()
        ).first()
        new_grouphash = GroupHash.objects.filter(hash=new_event.get_primary_hash()).first()
        assert existing_grouphash and new_grouphash

        # The grouphashes now point to different groups, but the `seer_matched_grouphash`
        # link remains
        assert existing_grouphash.group_id != new_grouphash.group_id
        assert (
            new_grouphash.metadata
            and new_grouphash.metadata.seer_matched_grouphash == existing_grouphash
        )

        with self.tasks():
            delete_groups(object_ids=[existing_event.group.id])

        assert not Group.objects.filter(id=existing_event.group.id).exists()
        assert not GroupHash.objects.filter(group_id=existing_event.group.id).exists()
        assert not GroupHashMetadata.objects.filter(grouphash_id=existing_grouphash.id).exists()

        # The unmerged grouphash and its metadata remain, but the `seer_matched_grouphash` link has
        # been broken so as not to cause integrity errors
        new_grouphash = GroupHash.objects.filter(hash=new_event.get_primary_hash()).first()
        assert new_grouphash and new_grouphash.metadata
        assert new_grouphash.metadata.seer_matched_grouphash is None
