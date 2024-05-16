from dataclasses import asdict
from unittest.mock import patch

from sentry.conf.server import SEER_SIMILARITY_MODEL_VERSION
from sentry.eventstore.models import Event
from sentry.grouping.ingest.seer import get_seer_similar_issues, should_call_seer_for_grouping
from sentry.grouping.result import CalculatedHashes
from sentry.seer.utils import SeerSimilarIssueData
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.helpers.features import with_feature
from sentry.utils.types import NonNone


class ShouldCallSeerTest(TestCase):
    # TODO: Add tests for rate limits, killswitches, etc once those are in place

    def test_obeys_seer_similarity_flags(self):
        for metadata_flag, grouping_flag, expected_result in [
            (False, False, False),
            (True, False, True),
            (False, True, True),
            (True, True, True),
        ]:
            with Feature(
                {
                    "projects:similarity-embeddings-metadata": metadata_flag,
                    "projects:similarity-embeddings-grouping": grouping_flag,
                }
            ):
                assert (
                    should_call_seer_for_grouping(
                        Event(
                            project_id=self.project.id,
                            event_id="11212012123120120415201309082013",
                            data={"title": "Dogs are great!"},
                        ),
                        self.project,
                    )
                    is expected_result
                ), f"Case ({metadata_flag}, {grouping_flag}) failed."

    @with_feature("projects:similarity-embeddings-grouping")
    def test_says_no_for_garbage_event(self):
        assert (
            should_call_seer_for_grouping(
                Event(
                    project_id=self.project.id,
                    event_id="11212012123120120415201309082013",
                    data={"title": "<untitled>"},
                ),
                self.project,
            )
            is False
        )


class GetSeerSimilarIssuesTest(TestCase):
    def setUp(self):
        self.existing_event = save_new_event({"message": "Dogs are great!"}, self.project)
        self.new_event = Event(
            project_id=self.project.id,
            event_id="11212012123120120415201309082013",
            data={"message": "Adopt don't shop"},
        )
        self.new_event_hashes = CalculatedHashes(
            hashes=["20130809201315042012311220122111"],
            hierarchical_hashes=[],
            tree_labels=[],
            variants={},
        )

    @with_feature({"projects:similarity-embeddings-grouping": False})
    def test_returns_metadata_but_no_group_if_seer_grouping_flag_off(self):
        seer_result_data = SeerSimilarIssueData(
            parent_hash=self.existing_event.get_primary_hash(),
            parent_group_id=NonNone(self.existing_event.group_id),
            stacktrace_distance=0.01,
            message_distance=0.05,
            should_group=True,
        )
        expected_metadata = {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "request_hash": self.new_event_hashes.hashes[0],
            "results": [asdict(seer_result_data)],
        }

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[seer_result_data],
        ):
            assert get_seer_similar_issues(self.new_event, self.new_event_hashes) == (
                expected_metadata,
                None,  # No group returned, even though `should_group` is True
            )

    @with_feature("projects:similarity-embeddings-grouping")
    def test_returns_metadata_and_group_if_sufficiently_close_group_found(self):
        seer_result_data = SeerSimilarIssueData(
            parent_hash=self.existing_event.get_primary_hash(),
            parent_group_id=NonNone(self.existing_event.group_id),
            stacktrace_distance=0.01,
            message_distance=0.05,
            should_group=True,
        )
        expected_metadata = {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "request_hash": self.new_event_hashes.hashes[0],
            "results": [asdict(seer_result_data)],
        }

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[seer_result_data],
        ):
            assert get_seer_similar_issues(self.new_event, self.new_event_hashes) == (
                expected_metadata,
                self.existing_event.group,
            )

    @with_feature("projects:similarity-embeddings-grouping")
    def test_returns_metadata_but_no_group_if_similar_group_insufficiently_close(self):
        seer_result_data = SeerSimilarIssueData(
            parent_hash=self.existing_event.get_primary_hash(),
            parent_group_id=NonNone(self.existing_event.group_id),
            stacktrace_distance=0.08,
            message_distance=0.12,
            should_group=False,
        )
        expected_metadata = {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "request_hash": self.new_event_hashes.hashes[0],
            "results": [asdict(seer_result_data)],
        }

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[seer_result_data],
        ):
            assert get_seer_similar_issues(self.new_event, self.new_event_hashes) == (
                expected_metadata,
                None,
            )

    @with_feature("projects:similarity-embeddings-grouping")
    def test_returns_no_group_and_empty_metadata_if_no_similar_group_found(self):
        expected_metadata = {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "request_hash": self.new_event_hashes.hashes[0],
            "results": [],
        }

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[],
        ):
            assert get_seer_similar_issues(self.new_event, self.new_event_hashes) == (
                expected_metadata,
                None,
            )
