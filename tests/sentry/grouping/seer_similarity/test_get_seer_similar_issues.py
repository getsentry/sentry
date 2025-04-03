from typing import Any
from unittest.mock import MagicMock, patch

from sentry import options
from sentry.eventstore.models import Event
from sentry.grouping.grouping_info import get_grouping_info_from_variants
from sentry.grouping.ingest.grouphash_metadata import create_or_update_grouphash_metadata_if_needed
from sentry.grouping.ingest.seer import get_seer_similar_issues
from sentry.grouping.variants import BaseVariant
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
from sentry.models.project import Project
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG
from sentry.seer.similarity.types import SeerSimilarIssueData
from sentry.seer.similarity.utils import get_stacktrace_string
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event


def create_new_event(
    project: Project,
    num_frames: int = 1,
    stacktrace_string: str | None = None,
    fingerprint: list[str] | None = None,
) -> tuple[Event, dict[str, BaseVariant], GroupHash, str]:
    error_type = "FailedToFetchError"
    error_value = "Charlie didn't bring the ball back"
    event = Event(
        project_id=project.id,
        event_id="12312012112120120908201304152013",
        data={
            "title": f"{error_type}('{error_value}')",
            "exception": {
                "values": [
                    {
                        "type": error_type,
                        "value": error_value,
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": f"play_fetch_{i}",
                                    "filename": f"dogpark{i}.py",
                                    "context_line": f"raise {error_type}('{error_value}')",
                                }
                                for i in range(num_frames)
                            ]
                        },
                    }
                ]
            },
            "platform": "python",
            "fingerprint": fingerprint or ["{{ default }}"],
        },
    )
    variants = event.get_grouping_variants()
    grouphash = GroupHash.objects.create(hash=event.get_primary_hash(), project_id=project.id)
    create_or_update_grouphash_metadata_if_needed(
        event, project, grouphash, True, DEFAULT_GROUPING_CONFIG, variants
    )

    if stacktrace_string is None:
        stacktrace_string = get_stacktrace_string(get_grouping_info_from_variants(variants))
    event.data["stacktrace_string"] = stacktrace_string

    return (event, variants, grouphash, stacktrace_string)


# Helper to make assertions less verbose
def assert_metrics_call(
    mock_metrics_function: MagicMock,
    metric_key: str,
    extra_tags: dict[str, Any] | None = None,
    value: Any | None = None,
) -> None:
    metric_call_args = [
        f"grouping.similarity.{metric_key}",
        *([value] if value is not None else []),
    ]
    metric_call_kwargs = {
        "sample_rate": options.get("seer.similarity.metrics_sample_rate"),
        "tags": {
            "platform": "python",
            **(extra_tags or {}),
        },
    }

    mock_metrics_function.assert_any_call(*metric_call_args, **metric_call_kwargs)


class GetSeerSimilarIssuesTest(TestCase):
    @patch("sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[])
    def test_sends_expected_data_to_seer(self, mock_get_similarity_data: MagicMock) -> None:
        new_event, new_variants, new_grouphash, new_stacktrace_string = create_new_event(
            self.project
        )

        get_seer_similar_issues(new_event, new_grouphash, new_variants)

        mock_get_similarity_data.assert_called_with(
            {
                "event_id": new_event.event_id,
                "hash": new_event.get_primary_hash(),
                "project_id": self.project.id,
                "stacktrace": new_stacktrace_string,
                "exception_type": "FailedToFetchError",
                "k": options.get("seer.similarity.ingest.num_matches_to_request"),
                "referrer": "ingest",
                "use_reranking": True,
            },
            {"hybrid_fingerprint": False},
        )


class ParentGroupFoundTest(TestCase):
    @patch("sentry.grouping.ingest.seer.metrics.incr")
    def test_simple(self, mock_incr: MagicMock) -> None:
        existing_event = save_new_event({"message": "Dogs are great!"}, self.project)
        existing_hash = existing_event.get_primary_hash()
        existing_grouphash = GroupHash.objects.filter(
            hash=existing_hash, project_id=self.project.id
        ).first()
        assert existing_event.group_id

        new_event, new_variants, new_grouphash, _ = create_new_event(self.project)

        seer_result_data = [
            SeerSimilarIssueData(
                parent_hash=existing_hash,
                parent_group_id=existing_event.group_id,
                stacktrace_distance=0.01,
                should_group=True,
            )
        ]

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=seer_result_data,
        ):
            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (
                0.01,
                existing_grouphash,
            )

            # Ensure we're not recording things we don't want to be. (The metrics we're checking
            # should only be recorded for events or parent grouphashes with hybrid fingerprints.)
            incr_metrics_recorded = {call.args[0] for call in mock_incr.mock_calls}
            assert "grouping.similarity.hybrid_fingerprint_match_check" not in incr_metrics_recorded

    @patch("sentry.grouping.ingest.seer.metrics.incr")
    def test_hybrid_fingerprint_match(self, mock_incr: MagicMock) -> None:
        existing_event = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["{{ default }}", "maisey"]},
            self.project,
        )
        existing_hash = existing_event.get_primary_hash()
        existing_grouphash = GroupHash.objects.filter(
            hash=existing_hash, project_id=self.project.id
        ).first()
        assert existing_event.group_id

        new_event, new_variants, new_grouphash, _ = create_new_event(
            self.project,
            fingerprint=["{{ default }}", "maisey"],
        )

        seer_result_data = [
            SeerSimilarIssueData(
                parent_hash=existing_hash,
                parent_group_id=existing_event.group_id,
                stacktrace_distance=0.01,
                should_group=True,
            )
        ]

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=seer_result_data,
        ):
            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (
                0.01,
                existing_grouphash,
            )
            assert_metrics_call(
                mock_incr, "hybrid_fingerprint_match_check", {"result": "fingerprint_match"}
            )

    @patch("sentry.grouping.ingest.seer.metrics.incr")
    def test_hybrid_fingerprint_mismatch(self, mock_incr: MagicMock) -> None:
        existing_event = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["{{ default }}", "maisey"]},
            self.project,
        )
        assert existing_event.group_id

        new_event, new_variants, new_grouphash, _ = create_new_event(
            self.project,
            fingerprint=["{{ default }}", "charlie"],
        )

        seer_result_data = [
            SeerSimilarIssueData(
                parent_hash=existing_event.get_primary_hash(),
                parent_group_id=existing_event.group_id,
                stacktrace_distance=0.01,
                should_group=True,
            )
        ]

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=seer_result_data,
        ):
            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (None, None)
            assert_metrics_call(
                mock_incr, "hybrid_fingerprint_match_check", {"result": "no_fingerprint_match"}
            )

    @patch("sentry.grouping.ingest.seer.metrics.incr")
    def test_hybrid_fingerprint_on_new_event_only(self, mock_incr: MagicMock) -> None:
        existing_event = save_new_event(
            {"message": "Dogs are great!"},
            self.project,
        )
        assert existing_event.group_id

        new_event, new_variants, new_grouphash, _ = create_new_event(
            self.project,
            fingerprint=["{{ default }}", "charlie"],
        )

        seer_result_data = [
            SeerSimilarIssueData(
                parent_hash=existing_event.get_primary_hash(),
                parent_group_id=existing_event.group_id,
                stacktrace_distance=0.01,
                should_group=True,
            )
        ]

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=seer_result_data,
        ):
            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (None, None)
            assert_metrics_call(
                mock_incr, "hybrid_fingerprint_match_check", {"result": "only_event_hybrid"}
            )

    @patch("sentry.grouping.ingest.seer.metrics.incr")
    def test_hybrid_fingerprint_on_parent_group_only(self, mock_incr: MagicMock) -> None:
        existing_event = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["{{ default }}", "maisey"]},
            self.project,
        )
        assert existing_event.group_id

        new_event, new_variants, new_grouphash, _ = create_new_event(self.project)

        seer_result_data = [
            SeerSimilarIssueData(
                parent_hash=existing_event.get_primary_hash(),
                parent_group_id=existing_event.group_id,
                stacktrace_distance=0.01,
                should_group=True,
            )
        ]

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=seer_result_data,
        ):
            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (None, None)
            assert_metrics_call(
                mock_incr, "hybrid_fingerprint_match_check", {"result": "only_parent_hybrid"}
            )

    @patch("sentry.grouping.ingest.seer.metrics.incr")
    def test_hybrid_fingerprint_no_parent_metadata(self, mock_incr: MagicMock) -> None:
        """
        Test that even when there's a match, no result will be returned if the matched hash has
        no metadata.
        """
        existing_event = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["{{ default }}", "maisey"]},
            self.project,
        )
        existing_hash = existing_event.get_primary_hash()
        existing_grouphash = GroupHash.objects.filter(
            hash=existing_hash, project_id=self.project.id
        ).first()
        assert existing_event.group_id
        assert existing_grouphash

        # Ensure the existing grouphash has no metadata
        GroupHashMetadata.objects.filter(grouphash=existing_grouphash).delete()
        assert existing_grouphash.metadata is None

        new_event, new_variants, new_grouphash, _ = create_new_event(
            self.project,
            fingerprint=["{{ default }}", "maisey"],
        )

        seer_result_data = [
            SeerSimilarIssueData(
                parent_hash=existing_hash,
                parent_group_id=existing_event.group_id,
                stacktrace_distance=0.01,
                should_group=True,
            )
        ]

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=seer_result_data,
        ):
            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (None, None)
            assert_metrics_call(
                mock_incr, "hybrid_fingerprint_match_check", {"result": "no_parent_metadata"}
            )


class NoParentGroupFoundTest(TestCase):
    @patch("sentry.grouping.ingest.seer.metrics.incr")
    def test_simple(self, mock_incr: MagicMock) -> None:
        new_event, new_variants, new_grouphash, _ = create_new_event(self.project)

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[],
        ):
            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (None, None)

            # Ensure we're not recording things we don't want to be. (The metrics we're checking
            # should only be recorded for events or parent grouphashes with hybrid fingerprints.)
            incr_metrics_recorded = {call.args[0] for call in mock_incr.mock_calls}
            assert "grouping.similarity.hybrid_fingerprint_match_check" not in incr_metrics_recorded

    @patch("sentry.grouping.ingest.seer.metrics.incr")
    def test_hybrid_fingerprint(self, mock_incr: MagicMock) -> None:
        new_event, new_variants, new_grouphash, _ = create_new_event(
            self.project,
            fingerprint=["{{ default }}", "maisey"],
        )

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[],
        ):
            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (None, None)

            # Ensure we're not recording things we don't want to be. (This metric should only be
            # recorded when there are results to check.)
            incr_metrics_recorded = {call.args[0] for call in mock_incr.mock_calls}
            assert "grouping.similarity.hybrid_fingerprint_match_check" not in incr_metrics_recorded
