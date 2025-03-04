from dataclasses import asdict
from time import time
from typing import Any
from unittest.mock import ANY, MagicMock, patch
from uuid import uuid1

from sentry import options
from sentry.conf.server import SEER_SIMILARITY_MODEL_VERSION
from sentry.eventstore.models import Event
from sentry.grouping.grouping_info import get_grouping_info_from_variants
from sentry.grouping.ingest.grouphash_metadata import create_or_update_grouphash_metadata_if_needed
from sentry.grouping.ingest.seer import (
    _event_content_is_seer_eligible,
    get_seer_similar_issues,
    maybe_check_seer_for_matching_grouphash,
    should_call_seer_for_grouping,
)
from sentry.grouping.utils import hash_from_values
from sentry.grouping.variants import BaseVariant
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG
from sentry.seer.similarity.types import SeerSimilarIssueData
from sentry.seer.similarity.utils import (
    MAX_FRAME_COUNT,
    SEER_INELIGIBLE_EVENT_PLATFORMS,
    get_stacktrace_string,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.helpers.features import apply_feature_flag_on_cls, with_feature
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
            get_grouping_info_from_variants(self.variants)
        )
        self.event_grouphash = GroupHash(project_id=self.project.id, hash="908415")

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

    @with_feature({"organizations:grouping-hybrid-fingerprint-seer-usage": True})
    def test_obeys_custom_fingerprint_check_flag_on(self) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time()))

        default_fingerprint_event = Event(
            project_id=self.project.id,
            event_id="11212012123120120415201309082013",
            data={**self.event_data, "fingerprint": ["{{ default }}"]},
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

    # TODO: Delete this once the hybrid fingerprint + seer change is fully rolled out
    @with_feature({"organizations:grouping-hybrid-fingerprint-seer-usage": False})
    def test_obeys_customized_fingerprint_check_flag_off(self) -> None:
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
                "sentry.grouping.ingest.seer._has_too_many_contributing_frames",
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
            get_grouping_info_from_variants(empty_frame_variants)
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


@apply_feature_flag_on_cls("organizations:grouping-hybrid-fingerprint-seer-usage")
@apply_feature_flag_on_cls("organizations:grouphash-metadata-creation")
class GetSeerSimilarIssuesTest(TestCase):
    def create_new_event(
        self,
        num_frames: int = 1,
        stacktrace_string: str | None = None,
        fingerprint: list[str] | None = None,
    ) -> tuple[Event, dict[str, BaseVariant], GroupHash, str]:
        error_type = "FailedToFetchError"
        error_value = "Charlie didn't bring the ball back"
        event = Event(
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
        grouphash = GroupHash.objects.create(
            hash=event.get_primary_hash(), project_id=self.project.id
        )
        create_or_update_grouphash_metadata_if_needed(
            event, self.project, grouphash, True, DEFAULT_GROUPING_CONFIG, variants
        )

        if stacktrace_string is None:
            stacktrace_string = get_stacktrace_string(get_grouping_info_from_variants(variants))
        event.data["stacktrace_string"] = stacktrace_string

        return (event, variants, grouphash, stacktrace_string)

    @patch("sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[])
    def test_sends_expected_data_to_seer(self, mock_get_similarity_data: MagicMock) -> None:
        new_event, new_variants, new_grouphash, new_stacktrace_string = self.create_new_event()

        get_seer_similar_issues(new_event, new_grouphash, new_variants)

        mock_get_similarity_data.assert_called_with(
            {
                "event_id": new_event.event_id,
                "hash": new_event.get_primary_hash(),
                "project_id": self.project.id,
                "stacktrace": new_stacktrace_string,
                "exception_type": "FailedToFetchError",
                "k": 1,
                "referrer": "ingest",
                "use_reranking": True,
            },
            {"hybrid_fingerprint": False},
        )

    def test_parent_group_found_simple(self) -> None:
        existing_event = save_new_event({"message": "Dogs are great!"}, self.project)
        existing_hash = existing_event.get_primary_hash()
        existing_grouphash = GroupHash.objects.filter(
            hash=existing_hash, project_id=self.project.id
        ).first()
        assert existing_event.group_id

        new_event, new_variants, new_grouphash, _ = self.create_new_event()

        seer_result_data = SeerSimilarIssueData(
            parent_hash=existing_hash,
            parent_group_id=existing_event.group_id,
            stacktrace_distance=0.01,
            should_group=True,
        )

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[seer_result_data],
        ):
            expected_metadata = {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "results": [asdict(seer_result_data)],
            }

            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (
                expected_metadata,
                existing_grouphash,
            )

    @patch("sentry.grouping.ingest.seer.metrics.incr")
    def test_parent_group_found_hybrid_fingerprint_match(
        self, mock_metrics_incr: MagicMock
    ) -> None:
        existing_event = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["{{ default }}", "maisey"]},
            self.project,
        )
        existing_hash = existing_event.get_primary_hash()
        existing_grouphash = GroupHash.objects.filter(
            hash=existing_hash, project_id=self.project.id
        ).first()
        assert existing_event.group_id

        new_event, new_variants, new_grouphash, _ = self.create_new_event(
            fingerprint=["{{ default }}", "maisey"]
        )

        seer_result_data = SeerSimilarIssueData(
            parent_hash=existing_hash,
            parent_group_id=existing_event.group_id,
            stacktrace_distance=0.01,
            should_group=True,
        )

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[seer_result_data],
        ):
            expected_metadata = {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "results": [asdict(seer_result_data)],
            }

            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (
                expected_metadata,
                existing_grouphash,
            )
            mock_metrics_incr.assert_called_with(
                "grouping.similarity.hybrid_fingerprint_seer_result",
                sample_rate=options.get("seer.similarity.metrics_sample_rate"),
                tags={"platform": "python", "result": "fingerprint_match"},
            )

    @patch("sentry.grouping.ingest.seer.metrics.incr")
    def test_parent_group_found_hybrid_fingerprint_mismatch(
        self, mock_metrics_incr: MagicMock
    ) -> None:
        existing_event = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["{{ default }}", "maisey"]},
            self.project,
        )
        assert existing_event.group_id

        new_event, new_variants, new_grouphash, _ = self.create_new_event(
            fingerprint=["{{ default }}", "charlie"]
        )

        seer_result_data = SeerSimilarIssueData(
            parent_hash=existing_event.get_primary_hash(),
            parent_group_id=existing_event.group_id,
            stacktrace_distance=0.01,
            should_group=True,
        )

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[seer_result_data],
        ):
            expected_metadata = {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "results": [],
            }

            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (
                expected_metadata,
                None,
            )
            mock_metrics_incr.assert_called_with(
                "grouping.similarity.hybrid_fingerprint_seer_result",
                sample_rate=options.get("seer.similarity.metrics_sample_rate"),
                tags={"platform": "python", "result": "no_fingerprint_match"},
            )

    @patch("sentry.grouping.ingest.seer.metrics.incr")
    def test_parent_group_found_hybrid_fingerprint_on_new_event_only(
        self, mock_metrics_incr: MagicMock
    ) -> None:
        existing_event = save_new_event(
            {"message": "Dogs are great!"},
            self.project,
        )
        assert existing_event.group_id

        new_event, new_variants, new_grouphash, _ = self.create_new_event(
            fingerprint=["{{ default }}", "charlie"]
        )

        seer_result_data = SeerSimilarIssueData(
            parent_hash=existing_event.get_primary_hash(),
            parent_group_id=existing_event.group_id,
            stacktrace_distance=0.01,
            should_group=True,
        )

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[seer_result_data],
        ):
            expected_metadata = {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "results": [],
            }

            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (
                expected_metadata,
                None,
            )
            mock_metrics_incr.assert_called_with(
                "grouping.similarity.hybrid_fingerprint_seer_result",
                sample_rate=options.get("seer.similarity.metrics_sample_rate"),
                tags={"platform": "python", "result": "only_event_hybrid"},
            )

    @patch("sentry.grouping.ingest.seer.metrics.incr")
    def test_parent_group_found_hybrid_fingerprint_on_existing_event_only(
        self, mock_metrics_incr: MagicMock
    ) -> None:
        existing_event = save_new_event(
            {"message": "Dogs are great!", "fingerprint": ["{{ default }}", "maisey"]},
            self.project,
        )
        assert existing_event.group_id

        new_event, new_variants, new_grouphash, _ = self.create_new_event()

        seer_result_data = SeerSimilarIssueData(
            parent_hash=existing_event.get_primary_hash(),
            parent_group_id=existing_event.group_id,
            stacktrace_distance=0.01,
            should_group=True,
        )

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[seer_result_data],
        ):
            expected_metadata = {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "results": [],
            }

            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (
                expected_metadata,
                None,
            )
            mock_metrics_incr.assert_called_with(
                "grouping.similarity.hybrid_fingerprint_seer_result",
                sample_rate=options.get("seer.similarity.metrics_sample_rate"),
                tags={"platform": "python", "result": "only_parent_hybrid"},
            )

    @patch("sentry.grouping.ingest.seer.metrics.incr")
    def test_parent_group_found_hybrid_fingerprint_no_metadata(
        self, mock_metrics_incr: MagicMock
    ) -> None:
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

        new_event, new_variants, new_grouphash, _ = self.create_new_event(
            fingerprint=["{{ default }}", "maisey"]
        )

        seer_result_data = SeerSimilarIssueData(
            parent_hash=existing_hash,
            parent_group_id=existing_event.group_id,
            stacktrace_distance=0.01,
            should_group=True,
        )

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[seer_result_data],
        ):
            expected_metadata = {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "results": [],
            }

            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (
                expected_metadata,
                None,
            )
            mock_metrics_incr.assert_called_with(
                "grouping.similarity.hybrid_fingerprint_seer_result",
                sample_rate=options.get("seer.similarity.metrics_sample_rate"),
                tags={"platform": "python", "result": "no_parent_metadata"},
            )

    def test_no_parent_group_found_simple(self) -> None:
        new_event, new_variants, new_grouphash, _ = self.create_new_event()

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[],
        ):
            expected_metadata = {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "results": [],
            }

            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (
                expected_metadata,
                None,
            )

    @patch("sentry.grouping.ingest.seer.metrics.incr")
    def test_no_parent_group_found_hybrid_fingerprint(self, mock_metrics_incr: MagicMock) -> None:
        new_event, new_variants, new_grouphash, _ = self.create_new_event(
            fingerprint=["{{ default }}", "maisey"]
        )

        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
            return_value=[],
        ):
            expected_metadata = {
                "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                "results": [],
            }

            assert get_seer_similar_issues(new_event, new_grouphash, new_variants) == (
                expected_metadata,
                None,
            )
            mock_metrics_incr.assert_called_with(
                "grouping.similarity.hybrid_fingerprint_seer_result",
                sample_rate=options.get("seer.similarity.metrics_sample_rate"),
                tags={"platform": "python", "result": "no_seer_match"},
            )


class TestMaybeCheckSeerForMatchingGroupHash(TestCase):

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
            {"hybrid_fingerprint": False},
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
            {"hybrid_fingerprint": False},
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
