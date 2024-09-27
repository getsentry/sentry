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

            # No metadata stored, parent group not used (even though `should_group` is True)
            assert "seer_similarity" not in NonNone(new_event.group).data["metadata"]
            assert "seer_similarity" not in new_event.data
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

            # Metadata returned and stored
            assert get_seer_similar_issues_return_values[0][0] == expected_metadata
            assert new_event.data["seer_similarity"] == expected_metadata

            # Parent grouphash returned and parent group used
            assert get_seer_similar_issues_return_values[0][1] == expected_grouphash
            assert new_event.group_id == existing_event.group_id

    @patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True)
    @patch("sentry.grouping.ingest.seer.get_seer_similar_issues", return_value=({}, None))
    def test_calls_seer_if_no_group_found(self, mock_get_seer_similar_issues: MagicMock, _):
        for use_optimized_grouping, event_message in [
            (True, "Dogs are great!"),
            (False, "Adopt don't shop"),
        ]:
            with patch(
                "sentry.event_manager.project_uses_optimized_grouping",
                return_value=use_optimized_grouping,
            ):
                save_new_event({"message": event_message}, self.project)
                assert (
                    mock_get_seer_similar_issues.call_count == 1
                ), f"Case {use_optimized_grouping} failed"
                mock_get_seer_similar_issues.reset_mock()

    @patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True)
    @patch("sentry.grouping.ingest.seer.get_seer_similar_issues", return_value=({}, None))
    def test_bypasses_seer_if_group_found(self, mock_get_seer_similar_issues: MagicMock, _):
        for use_optimized_grouping, event_message in [
            (True, "Dogs are great!"),
            (False, "Adopt don't shop"),
        ]:
            with patch(
                "sentry.event_manager.project_uses_optimized_grouping",
                return_value=use_optimized_grouping,
            ):
                existing_event = save_new_event({"message": event_message}, self.project)
                assert mock_get_seer_similar_issues.call_count == 1

                new_event = save_new_event({"message": event_message}, self.project)
                assert existing_event.group_id == new_event.group_id
                assert mock_get_seer_similar_issues.call_count == 1  # didn't get called again

                mock_get_seer_similar_issues.reset_mock()

    @patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True)
    def test_stores_seer_results_in_metadata(self, _):
        for use_optimized_grouping, existing_event_message, new_event_message in [
            (True, "Dogs are great!", "Adopt don't shop"),
            (False, "Maisey is silly", "Charlie is goofy"),
        ]:
            with patch(
                "sentry.event_manager.project_uses_optimized_grouping",
                return_value=use_optimized_grouping,
            ):
                existing_event = save_new_event({"message": existing_event_message}, self.project)

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
                ):
                    new_event = save_new_event({"message": new_event_message}, self.project)
                    expected_metadata = {
                        "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                        "results": [asdict(seer_result_data)],
                    }

                assert new_event.data["seer_similarity"] == expected_metadata

    @patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True)
    def test_assigns_event_to_neighbor_group_if_found(self, _):
        for use_optimized_grouping, existing_event_message, new_event_message in [
            (True, "Dogs are great!", "Adopt don't shop"),
            (False, "Maisey is silly", "Charlie is goofy"),
        ]:
            with patch(
                "sentry.event_manager.project_uses_optimized_grouping",
                return_value=use_optimized_grouping,
            ):
                existing_event = save_new_event({"message": existing_event_message}, self.project)

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
                    new_event = save_new_event({"message": new_event_message}, self.project)

                    assert mock_get_similarity_data.call_count == 1
                    assert existing_event.group_id == new_event.group_id

                    mock_get_similarity_data.reset_mock()

    @patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True)
    def test_creates_new_group_if_no_neighbor_found(self, _):
        for use_optimized_grouping, existing_event_message, new_event_message in [
            (True, "Dogs are great!", "Adopt don't shop"),
            (False, "Maisey is silly", "Charlie is goofy"),
        ]:
            with patch(
                "sentry.event_manager.project_uses_optimized_grouping",
                return_value=use_optimized_grouping,
            ):
                existing_event = save_new_event({"message": existing_event_message}, self.project)

                with patch(
                    "sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[]
                ) as mock_get_similarity_data:
                    new_event = save_new_event({"message": new_event_message}, self.project)

                    assert mock_get_similarity_data.call_count == 1
                    assert existing_event.group_id != new_event.group_id

                    mock_get_similarity_data.reset_mock()
