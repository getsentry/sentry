from dataclasses import asdict
from time import time
from typing import Any
from unittest.mock import MagicMock, patch

from sentry.conf.server import SEER_SIMILARITY_MODEL_VERSION
from sentry.grouping.ingest.seer import get_seer_similar_issues, should_call_seer_for_grouping
from sentry.models.grouphash import GroupHash
from sentry.seer.similarity.types import SeerSimilarIssueData
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.pytest.mocking import capture_results
from sentry.utils.types import NonNone


class SeerEventManagerGroupingTest(TestCase):
    """Test whether Seer is called during ingest and if so, how the results are used"""

    def test_obeys_seer_similarity_flags(self):
        existing_event = save_new_event({"message": "Dogs are great!"}, self.project)
        seer_result_data = SeerSimilarIssueData(
            parent_hash=NonNone(existing_event.get_primary_hash()),
            parent_group_id=NonNone(existing_event.group_id),
            stacktrace_distance=0.01,
            message_distance=0.05,
            should_group=True,
        )

        get_seer_similar_issues_return_values: list[Any] = []

        with (
            patch(
                "sentry.grouping.ingest.seer.should_call_seer_for_grouping",
                wraps=should_call_seer_for_grouping,
            ) as should_call_seer_spy,
            patch(
                "sentry.grouping.ingest.seer.get_seer_similar_issues",
                wraps=capture_results(
                    get_seer_similar_issues, get_seer_similar_issues_return_values
                ),
            ) as get_seer_similar_issues_spy,
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
                return_value=[seer_result_data],
            ),
            patch(
                "sentry.grouping.ingest.seer.event_content_is_seer_eligible",
                return_value=True,
            ),
        ):

            # Project option not set
            self.project.update_option("sentry:similarity_backfill_completed", None)
            new_event = save_new_event({"message": "Adopt don't shop"}, self.project)

            # We checked whether to make the call, but didn't go through with it
            assert should_call_seer_spy.call_count == 1
            assert get_seer_similar_issues_spy.call_count == 0

            # Parent group not used (even though `should_group` is True)
            assert new_event.group_id != existing_event.group_id

            should_call_seer_spy.reset_mock()
            get_seer_similar_issues_spy.reset_mock()

            # Project option set
            self.project.update_option("sentry:similarity_backfill_completed", int(time()))
            new_event = save_new_event({"message": "Maisey is silly"}, self.project)
            expected_metadata = {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "results": [asdict(seer_result_data)],
            }
            # In real life just filtering on group id wouldn't be enough to guarantee us a
            # single, specific GroupHash record, but since the database resets before each test,
            # here it's okay
            expected_grouphash = GroupHash.objects.filter(
                group_id=NonNone(existing_event.group_id)
            ).first()

            # We checked whether to make the call, and then made it
            assert should_call_seer_spy.call_count == 1
            assert get_seer_similar_issues_spy.call_count == 1

            # Metadata returned (metadata storage is tested separately in
            # `test_stores_seer_results_in_grouphash_metadata`)
            assert get_seer_similar_issues_return_values[0][0] == expected_metadata

            # Parent grouphash returned and parent group used
            assert get_seer_similar_issues_return_values[0][1] == expected_grouphash
            assert new_event.group_id == existing_event.group_id

    @patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True)
    @patch("sentry.grouping.ingest.seer.get_seer_similar_issues", return_value=({}, None))
    def test_calls_seer_if_no_group_found(self, mock_get_seer_similar_issues: MagicMock, _):
        save_new_event({"message": "Dogs are great!"}, self.project)
        assert mock_get_seer_similar_issues.call_count == 1

    @patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True)
    @patch("sentry.grouping.ingest.seer.get_seer_similar_issues", return_value=({}, None))
    def test_bypasses_seer_if_group_found(self, mock_get_seer_similar_issues: MagicMock, _):
        existing_event = save_new_event({"message": "Dogs are great!"}, self.project)
        assert mock_get_seer_similar_issues.call_count == 1

        new_event = save_new_event({"message": "Dogs are great!"}, self.project)
        assert existing_event.group_id == new_event.group_id
        assert mock_get_seer_similar_issues.call_count == 1  # didn't get called again

    @with_feature("organizations:grouphash-metadata-creation")
    @patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True)
    def test_stores_seer_results_in_grouphash_metadata(self, _):
        def assert_correct_seer_metadata(
            grouphash,
            expected_seer_date_sent,
            expected_seer_event_sent,
            expected_seer_model,
            expected_seer_matched_grouphash,
            expected_seer_match_distance,
        ):
            metadata = grouphash.metadata

            assert metadata
            assert metadata.seer_date_sent == expected_seer_date_sent
            assert metadata.seer_event_sent == expected_seer_event_sent
            assert metadata.seer_model == expected_seer_model
            assert metadata.seer_matched_grouphash == expected_seer_matched_grouphash
            assert metadata.seer_match_distance == expected_seer_match_distance

        # Event which is sent but finds no match
        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[],
        ) as mock_get_similarity_data_from_seer:
            existing_event = save_new_event({"message": "Dogs are great!"}, self.project)

            existing_event_grouphash = GroupHash.objects.filter(
                hash=existing_event.get_primary_hash(), project_id=self.project.id
            ).first()

            assert existing_event_grouphash
            assert existing_event_grouphash.metadata
            assert (
                mock_get_similarity_data_from_seer.call_args.args[0]["hash"]
                == existing_event_grouphash.hash
            )

            assert_correct_seer_metadata(
                existing_event_grouphash,
                existing_event_grouphash.metadata.date_added,
                existing_event.event_id,
                SEER_SIMILARITY_MODEL_VERSION,
                None,
                None,
            )

        # Event which is sent and does find a match
        seer_result_data = SeerSimilarIssueData(
            parent_hash=existing_event.get_primary_hash(),
            parent_group_id=NonNone(existing_event.group_id),
            stacktrace_distance=0.01,
            message_distance=0.05,
            should_group=True,
        )

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[seer_result_data],
        ) as mock_get_similarity_data_from_seer:
            new_event = save_new_event({"message": "Adopt don't shop"}, self.project)

            assert new_event.group_id == existing_event.group_id

            new_event_grouphash = GroupHash.objects.filter(
                hash=new_event.get_primary_hash(), project_id=self.project.id
            ).first()

            assert new_event_grouphash
            assert new_event_grouphash.metadata
            assert (
                mock_get_similarity_data_from_seer.call_args.args[0]["hash"]
                == new_event_grouphash.hash
            )

            assert_correct_seer_metadata(
                new_event_grouphash,
                new_event_grouphash.metadata.date_added,
                new_event.event_id,
                SEER_SIMILARITY_MODEL_VERSION,
                existing_event_grouphash,
                seer_result_data.stacktrace_distance,
            )

        # Event which isn't sent
        with patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=False):
            third_event = save_new_event({"message": "Sit! Stay! Good dog!"}, self.project)

            third_event_grouphash = GroupHash.objects.filter(
                hash=third_event.get_primary_hash(), project_id=self.project.id
            ).first()

            assert third_event_grouphash
            assert third_event_grouphash.metadata

            assert_correct_seer_metadata(third_event_grouphash, None, None, None, None, None)

    @patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True)
    def test_assigns_event_to_neighbor_group_if_found(self, _):
        existing_event = save_new_event({"message": "Dogs are great!"}, self.project)

        seer_result_data = SeerSimilarIssueData(
            parent_hash=NonNone(existing_event.get_primary_hash()),
            parent_group_id=NonNone(existing_event.group_id),
            stacktrace_distance=0.01,
            message_distance=0.05,
            should_group=True,
        )

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[seer_result_data],
        ) as mock_get_similarity_data:
            new_event = save_new_event({"message": "Adopt don't shop"}, self.project)

            assert mock_get_similarity_data.call_count == 1
            assert existing_event.group_id == new_event.group_id

    @patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True)
    def test_creates_new_group_if_no_neighbor_found(self, _):
        existing_event = save_new_event({"message": "Dogs are great!"}, self.project)

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[]
        ) as mock_get_similarity_data:
            new_event = save_new_event({"message": "Adopt don't shop"}, self.project)

            assert mock_get_similarity_data.call_count == 1
            assert existing_event.group_id != new_event.group_id
