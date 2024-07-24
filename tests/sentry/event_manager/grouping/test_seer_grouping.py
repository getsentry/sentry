from dataclasses import asdict
from typing import Any
from unittest.mock import MagicMock, patch

from sentry.conf.server import SEER_SIMILARITY_MODEL_VERSION
from sentry.grouping.ingest.seer import get_seer_similar_issues, should_call_seer_for_grouping
from sentry.seer.similarity.types import SeerSimilarIssueData
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import Feature
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
        metadata_base = {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "results": [asdict(seer_result_data)],
        }

        get_seer_similar_issues_return_values: list[Any] = []

        with (
            patch(
                "sentry.event_manager.should_call_seer_for_grouping",
                wraps=should_call_seer_for_grouping,
            ) as should_call_seer_spy,
            patch(
                "sentry.event_manager.get_seer_similar_issues",
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

            with Feature(
                {
                    "projects:similarity-embeddings-metadata": False,
                    "projects:similarity-embeddings-grouping": False,
                }
            ):
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

            with Feature(
                {
                    "projects:similarity-embeddings-metadata": True,
                    "projects:similarity-embeddings-grouping": False,
                }
            ):
                new_event = save_new_event({"message": "Maisey is silly"}, self.project)
                expected_metadata = {**metadata_base, "request_hash": new_event.get_primary_hash()}

                # We checked whether to make the call, and then made it
                assert should_call_seer_spy.call_count == 1
                assert get_seer_similar_issues_spy.call_count == 1

                # Metadata returned and stored
                assert get_seer_similar_issues_return_values[0][0] == expected_metadata
                assert (
                    NonNone(new_event.group).data["metadata"]["seer_similarity"]
                    == expected_metadata
                )
                assert new_event.data["seer_similarity"] == expected_metadata

                # No parent group returned or used (even though `should_group` is True)
                assert get_seer_similar_issues_return_values[0][1] is None
                assert new_event.group_id != existing_event.group_id

                should_call_seer_spy.reset_mock()
                get_seer_similar_issues_spy.reset_mock()
                get_seer_similar_issues_return_values.pop()

            with Feature(
                {
                    "projects:similarity-embeddings-metadata": False,
                    "projects:similarity-embeddings-grouping": True,
                }
            ):
                new_event = save_new_event({"message": "Charlie is goofy"}, self.project)
                expected_metadata = {**metadata_base, "request_hash": new_event.get_primary_hash()}

                # We checked whether to make the call, and then made it
                assert should_call_seer_spy.call_count == 1
                assert get_seer_similar_issues_spy.call_count == 1

                # Metadata returned and stored (metadata flag being off doesn't matter because
                # grouping flag takes precedence)
                assert get_seer_similar_issues_return_values[0][0] == expected_metadata
                assert new_event.data["seer_similarity"] == expected_metadata

                # Parent group returned and used
                assert get_seer_similar_issues_return_values[0][1] == existing_event.group
                assert new_event.group_id == existing_event.group_id

                should_call_seer_spy.reset_mock()
                get_seer_similar_issues_spy.reset_mock()
                get_seer_similar_issues_return_values.pop()

            with Feature(
                {
                    "projects:similarity-embeddings-metadata": True,
                    "projects:similarity-embeddings-grouping": True,
                }
            ):
                new_event = save_new_event(
                    {"message": "Cori and Bodhi are ridiculous"}, self.project
                )
                expected_metadata = {**metadata_base, "request_hash": new_event.get_primary_hash()}

                # We checked whether to make the call, and then made it
                assert should_call_seer_spy.call_count == 1
                assert get_seer_similar_issues_spy.call_count == 1

                # Metadata returned and stored
                assert get_seer_similar_issues_return_values[0][0] == expected_metadata
                assert new_event.data["seer_similarity"] == expected_metadata

                # Parent group returned and used
                assert get_seer_similar_issues_return_values[0][1] == existing_event.group
                assert new_event.group_id == existing_event.group_id

    @patch("sentry.event_manager.should_call_seer_for_grouping", return_value=True)
    @patch("sentry.event_manager.get_seer_similar_issues", return_value=({}, None))
    def test_calls_seer_if_no_group_found(self, mock_get_seer_similar_issues: MagicMock, _):
        save_new_event({"message": "Dogs are great!"}, self.project)
        assert mock_get_seer_similar_issues.call_count == 1

    @patch("sentry.event_manager.should_call_seer_for_grouping", return_value=True)
    @patch("sentry.event_manager.get_seer_similar_issues", return_value=({}, None))
    def test_bypasses_seer_if_group_found(self, mock_get_seer_similar_issues: MagicMock, _):
        existing_event = save_new_event({"message": "Dogs are great!"}, self.project)
        assert mock_get_seer_similar_issues.call_count == 1

        new_event = save_new_event({"message": "Dogs are great!"}, self.project)
        assert existing_event.group_id == new_event.group_id
        assert mock_get_seer_similar_issues.call_count == 1  # didn't get called again

    @patch("sentry.event_manager.should_call_seer_for_grouping", return_value=True)
    def test_stores_seer_results_in_metadata(self, _):
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
        ):
            new_event = save_new_event({"message": "Adopt don't shop"}, self.project)
            expected_metadata = {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "request_hash": new_event.get_primary_hash(),
                "results": [asdict(seer_result_data)],
            }

        assert NonNone(new_event.group).data["metadata"]["seer_similarity"] == expected_metadata
        assert new_event.data["seer_similarity"] == expected_metadata

    @with_feature("projects:similarity-embeddings-grouping")
    @patch("sentry.event_manager.should_call_seer_for_grouping", return_value=True)
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

    @with_feature("projects:similarity-embeddings-grouping")
    @patch("sentry.event_manager.should_call_seer_for_grouping", return_value=True)
    def test_creates_new_group_if_no_neighbor_found(self, _):
        existing_event = save_new_event({"message": "Dogs are great!"}, self.project)

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[]
        ) as mock_get_similarity_data:
            new_event = save_new_event({"message": "Adopt don't shop"}, self.project)

            assert mock_get_similarity_data.call_count == 1
            assert existing_event.group_id != new_event.group_id

    @with_feature("projects:similarity-embeddings-grouping")
    @patch("sentry.event_manager.should_call_seer_for_grouping", return_value=True)
    def test_creates_new_group_if_too_far_neighbor_found(self, _):
        existing_event = save_new_event({"message": "Dogs are great!"}, self.project)

        no_cigar_data = SeerSimilarIssueData(
            parent_hash=NonNone(existing_event.get_primary_hash()),
            parent_group_id=NonNone(existing_event.group_id),
            stacktrace_distance=0.10,
            message_distance=0.05,
            should_group=False,
        )

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[no_cigar_data],
        ) as mock_get_similarity_data:
            new_event = save_new_event({"message": "Adopt don't shop"}, self.project)

            assert mock_get_similarity_data.call_count == 1
            assert existing_event.group_id != new_event.group_id
