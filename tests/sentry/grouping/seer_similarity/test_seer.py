from time import time
from unittest.mock import ANY, MagicMock, patch

from sentry import options
from sentry.grouping.ingest.seer import maybe_check_seer_for_matching_grouphash
from sentry.models.grouphash import GroupHash
from sentry.seer.similarity.types import GroupingVersion
from sentry.services.eventstore.models import Event
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
                "model": GroupingVersion.V1,
                "training_mode": False,
            },
            {
                "platform": "python",
                "model_version": "v1",
                "training_mode": False,
                "hybrid_fingerprint": False,
            },
        )

    @patch("sentry.grouping.ingest.seer.record_did_call_seer_metric")
    @patch("sentry.grouping.ingest.seer.get_seer_similar_issues")
    @patch("sentry.seer.similarity.utils.metrics")
    def test_too_many_tokens(
        self,
        mock_metrics: MagicMock,
        mock_get_similar_issues: MagicMock,
        mock_record_did_call_seer: MagicMock,
    ) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        # Set a very low token limit to make the test reliable and easy to exceed
        with self.options({"seer.similarity.max_token_count": 10}):
            error_type = "FailedToFetchError"
            error_value = "Charlie didn't bring the ball back"
            # Even with simple frames, the stacktrace string will exceed 10 tokens
            context_line = f"raise {error_type}('{error_value}')"
            new_event = Event(
                project_id=self.project.id,
                event_id="33312012112120120908201304152013",
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
                                        for i in range(3)  # Just 3 frames
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
                "grouping.similarity.stacktrace_length_filter",
                sample_rate=sample_rate,
                tags={
                    "platform": "java",
                    "referrer": "ingest",
                    "outcome": "block_tokens",
                    "stacktrace_type": "system",
                },
            )
            mock_record_did_call_seer.assert_any_call(
                new_event, call_made=False, blocker="stacktrace-too-long"
            )

            mock_get_similar_issues.assert_not_called()

    @patch("sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[])
    def test_bypassed_platform_calls_seer_regardless_of_length(
        self, mock_get_similarity_data: MagicMock
    ) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        # Set a low token limit to ensure the stacktrace would be blocked if not bypassed
        with self.options({"seer.similarity.max_token_count": 100}):
            error_type = "FailedToFetchError"
            error_value = "Charlie didn't bring the ball back"
            context_line = f"raise {error_type}('{error_value}')"
            # Create a stacktrace that would exceed the token limit if not bypassed
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
                                        for i in range(20)
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
                    "model": GroupingVersion.V1,
                    "training_mode": False,
                },
                {
                    "platform": "python",
                    "model_version": "v1",
                    "training_mode": False,
                    "hybrid_fingerprint": False,
                },
            )
