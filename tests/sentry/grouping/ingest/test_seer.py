from dataclasses import asdict
from time import time
from unittest.mock import MagicMock, patch

from sentry.conf.server import SEER_SIMILARITY_MODEL_VERSION
from sentry.eventstore.models import Event
from sentry.grouping.ingest.seer import get_seer_similar_issues, should_call_seer_for_grouping
from sentry.models.grouphash import GroupHash
from sentry.seer.similarity.types import SeerSimilarIssueData
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.helpers.options import override_options
from sentry.utils.types import NonNone


class ShouldCallSeerTest(TestCase):
    def setUp(self) -> None:
        self.event_data = {
            "title": "FailedToFetchError('Charlie didn't bring the ball back')",
            "exception": {
                "values": [
                    {
                        "type": "FailedToFetchError",
                        "value": "Charlie didn't bring the ball back",
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "play_fetch",
                                    "filename": "dogpark.py",
                                    "context_line": "raise FailedToFetchError('Charlie didn't bring the ball back')",
                                }
                            ]
                        },
                    }
                ]
            },
            "platform": "python",
        }

        self.event = Event(
            project_id=self.project.id,
            event_id="11212012123120120415201309082013",
            data=self.event_data,
        )
        self.variants = self.event.get_grouping_variants()
        self.primary_hashes = self.event.get_hashes()

    def test_obeys_feature_enablement_check(self) -> None:
        for backfill_completed_option, expected_result in [(None, False), (11211231, True)]:
            self.project.update_option(
                "sentry:similarity_backfill_completed", backfill_completed_option
            )
            assert (
                should_call_seer_for_grouping(self.event, self.variants) is expected_result
            ), f"Case {backfill_completed_option} failed."

    def test_obeys_content_filter(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        for content_eligibility, expected_result in [(True, True), (False, False)]:
            with patch(
                "sentry.grouping.ingest.seer.event_content_is_seer_eligible",
                return_value=content_eligibility,
            ):
                assert should_call_seer_for_grouping(self.event, self.variants) is expected_result

    def test_obeys_global_seer_killswitch(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        for killswitch_enabled, expected_result in [(True, False), (False, True)]:
            with override_options({"seer.global-killswitch.enabled": killswitch_enabled}):
                assert should_call_seer_for_grouping(self.event, self.variants) is expected_result

    def test_obeys_similarity_service_killswitch(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        for killswitch_enabled, expected_result in [(True, False), (False, True)]:
            with override_options({"seer.similarity-killswitch.enabled": killswitch_enabled}):
                assert should_call_seer_for_grouping(self.event, self.variants) is expected_result

    def test_obeys_project_specific_killswitch(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        for blocked_projects, expected_result in [([self.project.id], False), ([], True)]:
            with override_options(
                {"seer.similarity.grouping_killswitch_projects": blocked_projects}
            ):
                assert should_call_seer_for_grouping(self.event, self.variants) is expected_result

    def test_obeys_global_ratelimit(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        for ratelimit_enabled, expected_result in [(True, False), (False, True)]:
            with patch(
                "sentry.grouping.ingest.seer.ratelimiter.backend.is_limited",
                wraps=lambda key, is_enabled=ratelimit_enabled, **_kwargs: (
                    is_enabled if key == "seer:similarity:global-limit" else False
                ),
            ):
                assert should_call_seer_for_grouping(self.event, self.variants) is expected_result

    def test_obeys_project_ratelimit(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        for ratelimit_enabled, expected_result in [(True, False), (False, True)]:
            with patch(
                "sentry.grouping.ingest.seer.ratelimiter.backend.is_limited",
                wraps=lambda key, is_enabled=ratelimit_enabled, **_kwargs: (
                    is_enabled
                    if key == f"seer:similarity:project-{self.project.id}-limit"
                    else False
                ),
            ):
                assert should_call_seer_for_grouping(self.event, self.variants) is expected_result

    def test_obeys_circuit_breaker(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        for request_allowed, expected_result in [(True, True), (False, False)]:
            with patch(
                "sentry.grouping.ingest.seer.CircuitBreaker.should_allow_request",
                return_value=request_allowed,
            ):
                assert should_call_seer_for_grouping(self.event, self.variants) is expected_result

    def test_obeys_customized_fingerprint_check(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        default_fingerprint_event = Event(
            project_id=self.project.id,
            event_id="11212012123120120415201309082013",
            data={**self.event_data, "fingerprint": ["{{ default }}"]},
        )
        hybrid_fingerprint_event = Event(
            project_id=self.project.id,
            event_id="12312012041520130908201311212012",
            data={**self.event_data, "fingerprint": ["{{ default }}", "maisey"]},
        )
        custom_fingerprint_event = Event(
            project_id=self.project.id,
            event_id="04152013090820131121201212312012",
            data={**self.event_data, "fingerprint": ["charlie"]},
        )
        built_in_fingerprint_event = Event(
            project_id=self.project.id,
            event_id="09082013112120121231201204152013",
            data={
                **self.event_data,
                "fingerprint": ["failedtofetcherror"],
                "_fingerprint_info": {"matched_rule": {"is_builtin": True}},
            },
        )

        for event, expected_result in [
            (default_fingerprint_event, True),
            (hybrid_fingerprint_event, False),
            (custom_fingerprint_event, False),
            (built_in_fingerprint_event, False),
        ]:

            assert (
                should_call_seer_for_grouping(event, event.get_grouping_variants())
                is expected_result
            ), f'Case with fingerprint {event.data["fingerprint"]} failed.'


class GetSeerSimilarIssuesTest(TestCase):
    def setUp(self) -> None:
        self.existing_event = save_new_event({"message": "Dogs are great!"}, self.project)
        assert self.existing_event.get_primary_hash() == "04e89719410791836f0a0bbf03bf0d2e"
        # In real life just filtering on group id wouldn't be enough to guarantee us a single,
        # specific GroupHash record, but since the database resets before each test, here it's okay
        self.existing_event_grouphash = GroupHash.objects.filter(
            group_id=NonNone(self.existing_event.group_id)
        ).first()
        self.new_event = Event(
            project_id=self.project.id,
            event_id="11212012123120120415201309082013",
            data={"message": "Adopt don't shop"},
        )
        self.variants = self.new_event.get_grouping_variants()
        assert self.new_event.get_primary_hash() == "3f11319f08263b2ee1e654779742955a"

    @patch("sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[])
    def test_sends_expected_data_to_seer(self, mock_get_similarity_data: MagicMock) -> None:
        type = "FailedToFetchError"
        value = "Charlie didn't bring the ball back"
        context_line = f"raise {type}('{value}')"
        new_event = Event(
            project_id=self.project.id,
            event_id="12312012112120120908201304152013",
            data={
                "title": f"{type}('{value}')",
                "exception": {
                    "values": [
                        {
                            "type": type,
                            "value": value,
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
        get_seer_similar_issues(new_event, new_event.get_grouping_variants())

        mock_get_similarity_data.assert_called_with(
            {
                "event_id": new_event.event_id,
                "hash": new_event.get_primary_hash(),
                "project_id": self.project.id,
                "stacktrace": f'{type}: {value}\n  File "dogpark.py", function play_fetch\n    {context_line}',
                "exception_type": "FailedToFetchError",
                "k": 1,
                "referrer": "ingest",
                "use_reranking": True,
            }
        )

    def test_returns_metadata_and_grouphash_if_sufficiently_close_group_found(self) -> None:
        seer_result_data = SeerSimilarIssueData(
            parent_hash=NonNone(self.existing_event.get_primary_hash()),
            parent_group_id=NonNone(self.existing_event.group_id),
            stacktrace_distance=0.01,
            message_distance=0.05,
            should_group=True,
        )
        expected_metadata = {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "results": [asdict(seer_result_data)],
        }

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[seer_result_data],
        ):
            assert get_seer_similar_issues(self.new_event, self.variants) == (
                expected_metadata,
                self.existing_event_grouphash,
            )

    def test_returns_no_grouphash_and_empty_metadata_if_no_similar_group_found(self) -> None:
        expected_metadata = {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "results": [],
        }

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[],
        ):
            assert get_seer_similar_issues(self.new_event, self.variants) == (
                expected_metadata,
                None,
            )
