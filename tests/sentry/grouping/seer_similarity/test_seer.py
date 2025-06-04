from time import time
from unittest.mock import ANY, MagicMock, patch

from sentry import options
from sentry.eventstore.models import Event
from sentry.grouping.ingest.seer import maybe_check_seer_for_matching_grouphash
from sentry.models.grouphash import GroupHash
from sentry.seer.similarity.utils import MAX_FRAME_COUNT
from sentry.testutils.cases import TestCase


class MaybeCheckSeerForMatchingGroupHashTest(TestCase):
    @patch("sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[])
    def test_simple(self, mock_get_similarity_data: MagicMock) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        error_type = "FailedToFetchError"
        error_value = "Charlie didn't bring the ball back"
        context_line = f"raise {error_type}('{error_value}')"
        new_event = Event(
            project_id=self.project.id,
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
                                        "function": "play_fetch",
                                        "filename": "dogpark.py",
                                        "context_line": context_line,
                                    }
                                ]
                            },
                        }
                    ]
                },
                "platform": "python",
            },
        )
        new_grouphash = GroupHash.objects.create(
            project=self.project, group=new_event.group, hash=new_event.get_primary_hash()
        )
        group_hashes = list(GroupHash.objects.filter(project_id=self.project.id))
        maybe_check_seer_for_matching_grouphash(
            new_event, new_grouphash, new_event.get_grouping_variants(), group_hashes
        )

        mock_get_similarity_data.assert_called_with(
            {
                "event_id": new_event.event_id,
                "hash": new_event.get_primary_hash(),
                "project_id": self.project.id,
                "stacktrace": f'{error_type}: {error_value}\n  File "dogpark.py", function play_fetch\n    {context_line}',
                "exception_type": "FailedToFetchError",
                "k": 1,
                "referrer": "ingest",
                "use_reranking": True,
            },
            {"platform": "python", "hybrid_fingerprint": False},
        )

    @patch("sentry.grouping.ingest.seer.record_did_call_seer_metric")
    @patch("sentry.grouping.ingest.seer.get_seer_similar_issues")
    @patch("sentry.seer.similarity.utils.metrics")
    def test_too_many_frames(
        self,
        mock_metrics: MagicMock,
        mock_get_similar_issues: MagicMock,
        mock_record_did_call_seer: MagicMock,
    ) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        error_type = "FailedToFetchError"
        error_value = "Charlie didn't bring the ball back"
        context_line = f"raise {error_type}('{error_value}')"
        new_event = Event(
            project_id=self.project.id,
            event_id="22312012112120120908201304152013",
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
                                        "context_line": context_line,
                                    }
                                    for i in range(MAX_FRAME_COUNT + 1)
                                ]
                            },
                        }
                    ]
                },
                "platform": "java",
            },
        )

        new_grouphash = GroupHash.objects.create(
            project=self.project, group=new_event.group, hash=new_event.get_primary_hash()
        )
        group_hashes = list(GroupHash.objects.filter(project_id=self.project.id))
        maybe_check_seer_for_matching_grouphash(
            new_event, new_grouphash, new_event.get_grouping_variants(), group_hashes
        )

        sample_rate = options.get("seer.similarity.metrics_sample_rate")
        mock_metrics.incr.assert_any_call(
            "grouping.similarity.frame_count_filter",
            sample_rate=sample_rate,
            tags={
                "platform": "java",
                "referrer": "ingest",
                "stacktrace_type": "system",
                "outcome": "block",
            },
        )
        mock_record_did_call_seer.assert_any_call(
            new_event, call_made=False, blocker="excess-frames"
        )

        mock_get_similar_issues.assert_not_called()

    @patch("sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[])
    def test_too_many_frames_bypassed_platform(self, mock_get_similarity_data: MagicMock) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        error_type = "FailedToFetchError"
        error_value = "Charlie didn't bring the ball back"
        context_line = f"raise {error_type}('{error_value}')"
        new_event = Event(
            project_id=self.project.id,
            event_id="22312012112120120908201304152013",
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
                                        "context_line": context_line,
                                    }
                                    for i in range(MAX_FRAME_COUNT + 1)
                                ]
                            },
                        }
                    ]
                },
                "platform": "python",
            },
        )

        new_grouphash = GroupHash.objects.create(
            project=self.project, group=new_event.group, hash=new_event.get_primary_hash()
        )
        group_hashes = list(GroupHash.objects.filter(project_id=self.project.id))
        maybe_check_seer_for_matching_grouphash(
            new_event, new_grouphash, new_event.get_grouping_variants(), group_hashes
        )

        mock_get_similarity_data.assert_called_with(
            {
                "event_id": new_event.event_id,
                "hash": new_event.get_primary_hash(),
                "project_id": self.project.id,
                "stacktrace": ANY,
                "exception_type": "FailedToFetchError",
                "k": 1,
                "referrer": "ingest",
                "use_reranking": True,
            },
            {"platform": "python", "hybrid_fingerprint": False},
        )
