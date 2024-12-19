from dataclasses import asdict
from time import time
from typing import Any
from unittest.mock import ANY, MagicMock, Mock, call, patch
from uuid import uuid1

from sentry import options
from sentry.conf.server import SEER_SIMILARITY_MODEL_VERSION
from sentry.eventstore.models import Event
from sentry.grouping.ingest.seer import (
    _event_content_is_seer_eligible,
    get_seer_similar_issues,
    maybe_check_seer_for_matching_grouphash,
    should_call_seer_for_grouping,
)
from sentry.models.grouphash import GroupHash
from sentry.seer.similarity.types import SeerSimilarIssueData
from sentry.seer.similarity.utils import MAX_FRAME_COUNT, SEER_INELIGIBLE_EVENT_PLATFORMS
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.helpers.options import override_options


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
                "sentry.grouping.ingest.seer._event_content_is_seer_eligible",
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
                "_fingerprint_info": {
                    "matched_rule": {
                        "is_builtin": True,
                        "matchers": [["type", "FailedToFetchError"]],
                        "fingerprint": ["failedtofetcherror"],
                        "text": 'type:"FailedToFetchError" -> "failedtofetcherror"',
                    }
                },
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

    @patch("sentry.grouping.ingest.seer.record_did_call_seer_metric")
    def test_obeys_empty_stacktrace_string_check(self, mock_record_did_call_seer: Mock) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))
        new_event = Event(
            project_id=self.project.id,
            event_id="12312012112120120908201304152013",
            data={
                "title": "title",
                "platform": "python",
                "stacktrace": {"frames": [{}]},
            },
        )

        assert should_call_seer_for_grouping(new_event, new_event.get_grouping_variants()) is False
        mock_record_did_call_seer.assert_any_call(
            call_made=False, blocker="empty-stacktrace-string"
        )

    @patch("sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[])
    def test_stacktrace_string_not_saved_in_event(
        self, mock_get_similarity_data: MagicMock
    ) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", 1)
        event = save_new_event(self.event_data, self.project)
        assert mock_get_similarity_data.call_count == 1
        assert "raise FailedToFetchError('Charlie didn't bring the ball back')" in (
            mock_get_similarity_data.call_args.args[0]["stacktrace"]
        )

        assert event.data.get("stacktrace_string") is None


class GetSeerSimilarIssuesTest(TestCase):
    def setUp(self) -> None:
        self.existing_event = save_new_event({"message": "Dogs are great!"}, self.project)
        assert self.existing_event.get_primary_hash() == "04e89719410791836f0a0bbf03bf0d2e"
        # In real life just filtering on group id wouldn't be enough to guarantee us a single,
        # specific GroupHash record, but since the database resets before each test, here it's okay
        assert self.existing_event.group_id is not None
        self.existing_event_grouphash = GroupHash.objects.filter(
            group_id=self.existing_event.group_id
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
        assert self.existing_event.group_id
        seer_result_data = SeerSimilarIssueData(
            parent_hash=self.existing_event.get_primary_hash(),
            parent_group_id=self.existing_event.group_id,
            stacktrace_distance=0.01,
            should_group=True,
        )
        expected_metadata = {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "results": [asdict(seer_result_data)],
        }
        self.new_event.data["stacktrace_string"] = "stacktrace"
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
        self.new_event.data["stacktrace_string"] = "stacktrace"
        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[],
        ):
            assert get_seer_similar_issues(self.new_event, self.variants) == (
                expected_metadata,
                None,
            )

    @patch("sentry.grouping.ingest.seer.logger")
    def test_returns_no_grouphash_and_empty_metadata_if_empty_stacktrace(
        self, mock_logger: MagicMock
    ) -> None:
        expected_metadata = {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "results": [],
        }

        for stacktrace in ["", None]:
            self.new_event.data["stacktrace_string"] = ""
            with patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
                return_value=[],
            ):
                assert get_seer_similar_issues(self.new_event, self.variants) == (
                    expected_metadata,
                    None,
                )
            mock_logger.info.assert_called_with(
                "get_seer_similar_issues.empty_stacktrace",
                extra={
                    "event_id": self.new_event.event_id,
                    "project_id": self.new_event.project.id,
                    "stacktrace_string": "",
                },
            )

    @patch("sentry.seer.similarity.utils.record_did_call_seer_metric")
    @patch("sentry.seer.similarity.utils.metrics")
    def test_too_many_frames(
        self, mock_metrics: Mock, mock_record_did_call_seer: MagicMock
    ) -> None:
        type = "FailedToFetchError"
        value = "Charlie didn't bring the ball back"
        context_line = f"raise {type}('{value}')"
        new_event = Event(
            project_id=self.project.id,
            event_id="22312012112120120908201304152013",
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
        expected_metadata = {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "results": [],
        }
        assert get_seer_similar_issues(new_event, new_event.get_grouping_variants()) == (
            expected_metadata,
            None,
        )

        sample_rate = options.get("seer.similarity.metrics_sample_rate")
        mock_metrics.incr.assert_any_call(
            "grouping.similarity.over_threshold_only_system_frames",
            sample_rate=sample_rate,
            tags={"platform": "java", "referrer": "ingest"},
        )
        mock_record_did_call_seer.assert_any_call(call_made=False, blocker="over-threshold-frames")

    @patch("sentry.seer.similarity.utils.record_did_call_seer_metric")
    def test_too_many_frames_allowed_platform(self, mock_record_did_call_seer: MagicMock) -> None:
        type = "FailedToFetchError"
        value = "Charlie didn't bring the ball back"
        context_line = f"raise {type}('{value}')"
        new_event = Event(
            project_id=self.project.id,
            event_id="22312012112120120908201304152013",
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
        expected_metadata = {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "results": [],
        }
        assert get_seer_similar_issues(new_event, new_event.get_grouping_variants()) == (
            expected_metadata,
            None,
        )

        assert (
            call(call_made=False, blocker="over-threshold-frames")
            not in mock_record_did_call_seer.call_args_list
        )


class TestMaybeCheckSeerForMatchingGroupHash(TestCase):

    @patch("sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[])
    def test_valid_maybe_check_seer_for_matching_group_hash(
        self, mock_get_similarity_data: MagicMock
    ) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

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
        GroupHash.objects.create(
            project=self.project, group=new_event.group, hash=new_event.get_primary_hash()
        )
        group_hashes = list(GroupHash.objects.filter(project_id=self.project.id))
        maybe_check_seer_for_matching_grouphash(
            new_event, new_event.get_grouping_variants(), group_hashes
        )

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

    @patch("sentry.seer.similarity.utils.record_did_call_seer_metric")
    @patch("sentry.grouping.ingest.seer.get_seer_similar_issues")
    @patch("sentry.seer.similarity.utils.metrics")
    def test_too_many_only_system_frames_maybe_check_seer_for_matching_group_hash(
        self,
        mock_metrics: MagicMock,
        mock_get_similar_issues: MagicMock,
        mock_record_did_call_seer: MagicMock,
    ) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        type = "FailedToFetchError"
        value = "Charlie didn't bring the ball back"
        context_line = f"raise {type}('{value}')"
        new_event = Event(
            project_id=self.project.id,
            event_id="22312012112120120908201304152013",
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

        GroupHash.objects.create(
            project=self.project, group=new_event.group, hash=new_event.get_primary_hash()
        )
        group_hashes = list(GroupHash.objects.filter(project_id=self.project.id))
        maybe_check_seer_for_matching_grouphash(
            new_event, new_event.get_grouping_variants(), group_hashes
        )

        sample_rate = options.get("seer.similarity.metrics_sample_rate")
        mock_metrics.incr.assert_any_call(
            "grouping.similarity.over_threshold_only_system_frames",
            sample_rate=sample_rate,
            tags={"platform": "java", "referrer": "ingest"},
        )
        mock_record_did_call_seer.assert_any_call(call_made=False, blocker="over-threshold-frames")

        mock_get_similar_issues.assert_not_called()

    @patch("sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[])
    def test_too_many_only_system_frames_maybe_check_seer_for_matching_group_hash_invalid_platform(
        self, mock_get_similarity_data: MagicMock
    ) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        type = "FailedToFetchError"
        value = "Charlie didn't bring the ball back"
        context_line = f"raise {type}('{value}')"
        new_event = Event(
            project_id=self.project.id,
            event_id="22312012112120120908201304152013",
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

        GroupHash.objects.create(
            project=self.project, group=new_event.group, hash=new_event.get_primary_hash()
        )
        group_hashes = list(GroupHash.objects.filter(project_id=self.project.id))
        maybe_check_seer_for_matching_grouphash(
            new_event, new_event.get_grouping_variants(), group_hashes
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
            }
        )


class EventContentIsSeerEligibleTest(TestCase):
    def get_eligible_event_data(self) -> dict[str, Any]:
        return {
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

    def test_no_stacktrace(self) -> None:
        good_event_data = self.get_eligible_event_data()
        good_event = Event(
            project_id=self.project.id,
            event_id=uuid1().hex,
            data=good_event_data,
        )

        bad_event_data = self.get_eligible_event_data()
        del bad_event_data["exception"]
        bad_event = Event(
            project_id=self.project.id,
            event_id=uuid1().hex,
            data=bad_event_data,
        )

        assert _event_content_is_seer_eligible(good_event) is True
        assert _event_content_is_seer_eligible(bad_event) is False

    def test_platform_filter(self) -> None:
        good_event_data = self.get_eligible_event_data()
        good_event = Event(
            project_id=self.project.id,
            event_id=uuid1().hex,
            data=good_event_data,
        )

        bad_event_data = self.get_eligible_event_data()
        bad_event_data["platform"] = "other"
        bad_event = Event(
            project_id=self.project.id,
            event_id=uuid1().hex,
            data=bad_event_data,
        )

        assert good_event_data["platform"] not in SEER_INELIGIBLE_EVENT_PLATFORMS
        assert bad_event_data["platform"] in SEER_INELIGIBLE_EVENT_PLATFORMS
        assert _event_content_is_seer_eligible(good_event) is True
        assert _event_content_is_seer_eligible(bad_event) is False
