from time import time
from typing import Any
from unittest.mock import MagicMock, patch
from uuid import uuid1

from sentry.grouping.grouping_info import get_grouping_info_from_variants_legacy
from sentry.grouping.ingest.seer import (
    _event_content_is_seer_eligible,
    should_call_seer_for_grouping,
)
from sentry.grouping.utils import hash_from_values
from sentry.models.grouphash import GroupHash
from sentry.seer.similarity.utils import SEER_INELIGIBLE_EVENT_PLATFORMS, get_stacktrace_string
from sentry.services.eventstore.models import Event
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
        self.stacktrace_string = get_stacktrace_string(
            get_grouping_info_from_variants_legacy(self.variants)
        )
        self.event_grouphash = GroupHash.objects.create(project_id=self.project.id, hash="908415")

    def test_obeys_feature_enablement_check(self) -> None:
        for backfill_completed_option, expected_result in [(None, False), (11211231, True)]:
            self.project.update_option(
                "sentry:similarity_backfill_completed", backfill_completed_option
            )
            assert (
                should_call_seer_for_grouping(self.event, self.variants, self.event_grouphash)
                is expected_result
            ), f"Case {backfill_completed_option} failed."

    def test_obeys_content_filter(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        for content_eligibility, expected_result in [(True, True), (False, False)]:
            with patch(
                "sentry.grouping.ingest.seer._event_content_is_seer_eligible",
                return_value=content_eligibility,
            ):
                assert (
                    should_call_seer_for_grouping(self.event, self.variants, self.event_grouphash)
                    is expected_result
                )

    def test_obeys_global_seer_killswitch(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        for killswitch_enabled, expected_result in [(True, False), (False, True)]:
            with override_options({"seer.global-killswitch.enabled": killswitch_enabled}):
                assert (
                    should_call_seer_for_grouping(self.event, self.variants, self.event_grouphash)
                    is expected_result
                )

    def test_obeys_similarity_service_killswitch(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        for killswitch_enabled, expected_result in [(True, False), (False, True)]:
            with override_options({"seer.similarity-killswitch.enabled": killswitch_enabled}):
                assert (
                    should_call_seer_for_grouping(self.event, self.variants, self.event_grouphash)
                    is expected_result
                )

    def test_obeys_project_specific_killswitch(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        for blocked_projects, expected_result in [([self.project.id], False), ([], True)]:
            with override_options(
                {"seer.similarity.grouping_killswitch_projects": blocked_projects}
            ):
                assert (
                    should_call_seer_for_grouping(self.event, self.variants, self.event_grouphash)
                    is expected_result
                )

    def test_obeys_global_ratelimit(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        for ratelimit_enabled, expected_result in [(True, False), (False, True)]:
            with patch(
                "sentry.grouping.ingest.seer.ratelimiter.backend.is_limited",
                wraps=lambda key, is_enabled=ratelimit_enabled, **_kwargs: (
                    is_enabled if key == "seer:similarity:global-limit" else False
                ),
            ):
                assert (
                    should_call_seer_for_grouping(self.event, self.variants, self.event_grouphash)
                    is expected_result
                )

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
                assert (
                    should_call_seer_for_grouping(self.event, self.variants, self.event_grouphash)
                    is expected_result
                )

    def test_obeys_circuit_breaker(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        for request_allowed, expected_result in [(True, True), (False, False)]:
            with patch(
                "sentry.grouping.ingest.seer.CircuitBreaker.should_allow_request",
                return_value=request_allowed,
            ):
                assert (
                    should_call_seer_for_grouping(self.event, self.variants, self.event_grouphash)
                    is expected_result
                )

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
            (hybrid_fingerprint_event, True),
            (custom_fingerprint_event, False),
            (built_in_fingerprint_event, False),
        ]:
            grouphash = GroupHash(
                project_id=self.project.id, hash=hash_from_values(event.data["fingerprint"])
            )
            assert (
                should_call_seer_for_grouping(event, event.get_grouping_variants(), grouphash)
                is expected_result
            ), f'Case with fingerprint {event.data["fingerprint"]} failed.'

    def test_obeys_excessive_frame_check(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        for frame_check_result, expected_result in [(True, False), (False, True)]:
            with patch(
                "sentry.grouping.ingest.seer._stacktrace_exceeds_limits",
                return_value=frame_check_result,
            ):
                assert (
                    should_call_seer_for_grouping(self.event, self.variants, self.event_grouphash)
                    is expected_result
                )

    @patch("sentry.grouping.ingest.seer.record_did_call_seer_metric")
    def test_obeys_empty_stacktrace_string_check(
        self, mock_record_did_call_seer: MagicMock
    ) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        empty_frame_event = Event(
            project_id=self.project.id,
            event_id="12312012112120120908201304152013",
            data={
                "title": "Dogs are great!",
                "platform": "python",
                "stacktrace": {"frames": [{}]},
            },
        )
        empty_frame_variants = empty_frame_event.get_grouping_variants()
        empty_frame_grouphash = GroupHash(project_id=self.project.id, hash="415908")
        empty_frame_stacktrace_string = get_stacktrace_string(
            get_grouping_info_from_variants_legacy(empty_frame_variants)
        )

        assert self.stacktrace_string != ""
        assert (
            should_call_seer_for_grouping(self.event, self.variants, self.event_grouphash) is True
        )
        mock_record_did_call_seer.assert_not_called()

        assert empty_frame_stacktrace_string == ""
        assert (
            should_call_seer_for_grouping(
                empty_frame_event, empty_frame_variants, empty_frame_grouphash
            )
            is False
        )
        mock_record_did_call_seer.assert_any_call(
            empty_frame_event, call_made=False, blocker="empty-stacktrace-string"
        )

    @patch("sentry.grouping.ingest.seer.record_did_call_seer_metric")
    def test_obeys_race_condition_skip(self, mock_record_did_call_seer: MagicMock) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        assert self.event.should_skip_seer is False
        assert (
            should_call_seer_for_grouping(self.event, self.variants, self.event_grouphash) is True
        )

        self.event.should_skip_seer = True

        assert (
            should_call_seer_for_grouping(self.event, self.variants, self.event_grouphash) is False
        )
        mock_record_did_call_seer.assert_any_call(
            self.event, call_made=False, blocker="race_condition"
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
