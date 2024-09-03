from dataclasses import asdict
from unittest.mock import MagicMock, patch

from sentry.conf.server import SEER_SIMILARITY_MODEL_VERSION
from sentry.eventstore.models import Event
from sentry.grouping.ingest.seer import get_seer_similar_issues, should_call_seer_for_grouping
from sentry.grouping.result import CalculatedHashes
from sentry.models.grouphash import GroupHash
from sentry.seer.similarity.types import SeerSimilarIssueData
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.utils.types import NonNone


class ShouldCallSeerTest(TestCase):
    def setUp(self):
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
        self.primary_hashes = self.event.get_hashes()

    def test_obeys_feature_enablement_check(self):
        for grouping_flag, backfill_completed_option, expected_result in [
            (False, None, False),
            (True, None, True),
            (False, 11211231, True),
            (True, 11211231, True),
        ]:
            with Feature({"projects:similarity-embeddings-grouping": grouping_flag}):
                self.project.update_option(
                    "sentry:similarity_backfill_completed", backfill_completed_option
                )
                assert (
                    should_call_seer_for_grouping(self.event, self.primary_hashes)
                    is expected_result
                ), f"Case (grouping {grouping_flag}, backfill completed {backfill_completed_option}) failed."

    @with_feature("projects:similarity-embeddings-grouping")
    def test_obeys_content_filter(self):
        for content_eligibility, expected_result in [(True, True), (False, False)]:
            with patch(
                "sentry.grouping.ingest.seer.event_content_is_seer_eligible",
                return_value=content_eligibility,
            ):
                assert (
                    should_call_seer_for_grouping(self.event, self.primary_hashes)
                    is expected_result
                )

    @with_feature("projects:similarity-embeddings-grouping")
    def test_obeys_global_seer_killswitch(self):
        for killswitch_enabled, expected_result in [(True, False), (False, True)]:
            with override_options({"seer.global-killswitch.enabled": killswitch_enabled}):
                assert (
                    should_call_seer_for_grouping(self.event, self.primary_hashes)
                    is expected_result
                )

    @with_feature("projects:similarity-embeddings-grouping")
    def test_obeys_similarity_service_killswitch(self):
        for killswitch_enabled, expected_result in [(True, False), (False, True)]:
            with override_options({"seer.similarity-killswitch.enabled": killswitch_enabled}):
                assert (
                    should_call_seer_for_grouping(self.event, self.primary_hashes)
                    is expected_result
                )

    @with_feature("projects:similarity-embeddings-grouping")
    def test_obeys_project_specific_killswitch(self):
        for blocked_projects, expected_result in [([self.project.id], False), ([], True)]:
            with override_options(
                {"seer.similarity.grouping_killswitch_projects": blocked_projects}
            ):
                assert (
                    should_call_seer_for_grouping(self.event, self.primary_hashes)
                    is expected_result
                )

    @with_feature("projects:similarity-embeddings-grouping")
    def test_obeys_global_ratelimit(self):
        for ratelimit_enabled, expected_result in [(True, False), (False, True)]:
            with patch(
                "sentry.grouping.ingest.seer.ratelimiter.backend.is_limited",
                wraps=lambda key, is_enabled=ratelimit_enabled, **_kwargs: (
                    is_enabled if key == "seer:similarity:global-limit" else False
                ),
            ):
                assert (
                    should_call_seer_for_grouping(self.event, self.primary_hashes)
                    is expected_result
                )

    @with_feature("projects:similarity-embeddings-grouping")
    def test_obeys_project_ratelimit(self):
        for ratelimit_enabled, expected_result in [(True, False), (False, True)]:
            with patch(
                "sentry.grouping.ingest.seer.ratelimiter.backend.is_limited",
                wraps=lambda key, is_enabled=ratelimit_enabled, **_kwargs: (
                    is_enabled
                    if key == f"seer:similarity:project-{self.project.id}-limit"
                    else False
                ),
            ):
                assert (
                    should_call_seer_for_grouping(self.event, self.primary_hashes)
                    is expected_result
                )

    @with_feature("projects:similarity-embeddings-grouping")
    def test_obeys_circuit_breaker(self):
        for request_allowed, expected_result in [(True, True), (False, False)]:
            with patch(
                "sentry.grouping.ingest.seer.CircuitBreaker.should_allow_request",
                return_value=request_allowed,
            ):
                assert (
                    should_call_seer_for_grouping(self.event, self.primary_hashes)
                    is expected_result
                )

    @with_feature("projects:similarity-embeddings-grouping")
    def test_obeys_customized_fingerprint_check(self):
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
                "_fingerprint_info": {"is_builtin": True},
            },
        )

        for event, expected_result in [
            (default_fingerprint_event, True),
            (hybrid_fingerprint_event, False),
            (custom_fingerprint_event, False),
            (built_in_fingerprint_event, False),
        ]:

            assert (
                should_call_seer_for_grouping(event, event.get_hashes()) is expected_result
            ), f'Case with fingerprint {event.data["fingerprint"]} failed.'


class GetSeerSimilarIssuesTest(TestCase):
    def setUp(self):
        self.existing_event = save_new_event({"message": "Dogs are great!"}, self.project)
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
        self.new_event_hashes = CalculatedHashes(["20130809201315042012311220122111"])

    @patch("sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[])
    def test_sends_expected_data_to_seer(self, mock_get_similarity_data: MagicMock):
        new_event = Event(
            project_id=self.project.id,
            event_id="12312012112120120908201304152013",
            data={
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
            },
        )
        new_event_hashes = CalculatedHashes(["20130809201315042012311220122111"])

        with patch(
            "sentry.grouping.ingest.seer.get_stacktrace_string",
            return_value="<stacktrace string>",
        ):
            get_seer_similar_issues(new_event, new_event_hashes)

            mock_get_similarity_data.assert_called_with(
                {
                    "event_id": "12312012112120120908201304152013",
                    "hash": "20130809201315042012311220122111",
                    "project_id": self.project.id,
                    "stacktrace": "<stacktrace string>",
                    "message": "FailedToFetchError('Charlie didn't bring the ball back')",
                    "exception_type": "FailedToFetchError",
                    "k": 1,
                    "referrer": "ingest",
                    "use_reranking": True,
                }
            )

    def test_returns_metadata_and_grouphash_if_sufficiently_close_group_found(self):
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
            assert get_seer_similar_issues(self.new_event, self.new_event_hashes) == (
                expected_metadata,
                self.existing_event_grouphash,
            )

    def test_returns_no_grouphash_and_empty_metadata_if_no_similar_group_found(self):
        expected_metadata = {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
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
