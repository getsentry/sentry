from unittest import TestCase
from unittest.mock import MagicMock, patch

from sentry import options
from sentry.options import all as all_options
from sentry.testutils.helpers import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.rollout import SafeRolloutComparator


class TestRolloutComparator(SafeRolloutComparator):
    ROLLOUT_NAME = "test_rollout"


TEST_SHOULD_RUN_EXPERIMENT_OPTION = TestRolloutComparator._should_run_experiment_option()
TEST_EXPERIMENT_SAMPLE_RATE_OPTION = TestRolloutComparator._experiment_sample_rate_option()
TEST_CALLSITE_SAMPLE_RATE_OPTION = TestRolloutComparator._callsite_sample_rate_option()
TEST_CALLSITE_EXPERIMENT_BLOCKLIST_OPTION = (
    TestRolloutComparator._callsite_experiment_blocklist_option()
)
TEST_CALLSITE_MISMATCH_LOG_ALLOWLIST_OPTION = (
    TestRolloutComparator._callsite_mismatch_log_allowlist_option()
)
TEST_CALLSITE_USE_EXPERIMENTAL_DATA_ALLOWLIST_OPTION = (
    TestRolloutComparator._callsite_use_experimental_data_allowlist_option()
)


@django_db_all
class SafeRolloutComparatorTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        # We need to instantiate the comparator class in order for the options to be registered
        TestRolloutComparator()

    def test_all_options_registered(self) -> None:
        option_names = [o.name for o in all_options()]

        assert TEST_SHOULD_RUN_EXPERIMENT_OPTION in option_names
        assert TEST_EXPERIMENT_SAMPLE_RATE_OPTION in option_names
        assert TEST_CALLSITE_SAMPLE_RATE_OPTION in option_names
        assert TEST_CALLSITE_EXPERIMENT_BLOCKLIST_OPTION in option_names
        assert TEST_CALLSITE_MISMATCH_LOG_ALLOWLIST_OPTION in option_names
        assert TEST_CALLSITE_USE_EXPERIMENTAL_DATA_ALLOWLIST_OPTION in option_names

    def test_experiment_enablement(self) -> None:
        with override_options({TEST_SHOULD_RUN_EXPERIMENT_OPTION: False}):
            assert options.get(TEST_EXPERIMENT_SAMPLE_RATE_OPTION) == 1.0
            assert options.get(TEST_CALLSITE_EXPERIMENT_BLOCKLIST_OPTION) == []
            # Even though the sample rate is 100% (the default), and the callsite isn't blocklisted,
            # the experiment won't run
            assert TestRolloutComparator.should_check_experiment("test_1") is False

        with override_options({TEST_SHOULD_RUN_EXPERIMENT_OPTION: True}):
            assert TestRolloutComparator.should_check_experiment("test_2") is True

    def test_experiment_sample_rate(self) -> None:
        with override_options(
            {
                TEST_SHOULD_RUN_EXPERIMENT_OPTION: True,
                TEST_EXPERIMENT_SAMPLE_RATE_OPTION: 0.5,
            }
        ):
            with patch("sentry.utils.rollout.random.random", return_value=0.3):
                assert TestRolloutComparator.should_check_experiment("test_sampled_in") is True

            with patch("sentry.utils.rollout.random.random", return_value=0.7):
                assert TestRolloutComparator.should_check_experiment("test_sampled_out") is False

            with patch("sentry.utils.rollout.random.random", return_value=0.5):
                assert TestRolloutComparator.should_check_experiment("test_boundary") is False

            with patch("sentry.utils.rollout.random.random", return_value=0.49999):
                assert TestRolloutComparator.should_check_experiment("test_just_under") is True

    def test_callsite_sample_rate(self) -> None:
        with override_options(
            {
                TEST_SHOULD_RUN_EXPERIMENT_OPTION: True,
                TEST_EXPERIMENT_SAMPLE_RATE_OPTION: 0.25,
                TEST_CALLSITE_SAMPLE_RATE_OPTION: {
                    "dogs_are_great": 0.5,
                    "all_dogs_are_good": True,  # invalid value
                    "roll_over": "good_dog",  # invalid value
                },
            }
        ):
            # Value which passes both the general and valid callsite-specific rates
            with patch("sentry.utils.rollout.random.random", return_value=0.1):
                assert TestRolloutComparator.should_check_experiment("dogs_are_great") is True
                assert TestRolloutComparator.should_check_experiment("adopt_dont_shop") is True
            # Value which passes the `dogs_are_great` rate but not the general one
            with patch("sentry.utils.rollout.random.random", return_value=0.3):
                assert TestRolloutComparator.should_check_experiment("dogs_are_great") is True
                assert TestRolloutComparator.should_check_experiment("adopt_dont_shop") is False
            # Value which fails both the general and valid callsite-specific rates
            with patch("sentry.utils.rollout.random.random", return_value=0.75):
                assert TestRolloutComparator.should_check_experiment("dogs_are_great") is False
                assert TestRolloutComparator.should_check_experiment("adopt_dont_shop") is False
            # Value which passes the general rate, applied to callsites with invalid values
            with patch("sentry.utils.rollout.random.random", return_value=0.1):
                assert TestRolloutComparator.should_check_experiment("all_dogs_are_good") is True
                assert TestRolloutComparator.should_check_experiment("roll_over") is True
            # Value which fails the general rate, applied to callsites with invalid values
            with patch("sentry.utils.rollout.random.random", return_value=0.3):
                assert TestRolloutComparator.should_check_experiment("all_dogs_are_good") is False
                assert TestRolloutComparator.should_check_experiment("roll_over") is False

    def test_experiment_callsite_blocklist(self) -> None:
        with override_options(
            {
                TEST_SHOULD_RUN_EXPERIMENT_OPTION: True,
                TEST_CALLSITE_EXPERIMENT_BLOCKLIST_OPTION: ["test_blocked"],
            }
        ):
            assert options.get(TEST_EXPERIMENT_SAMPLE_RATE_OPTION) == 1.0
            # Even with 100% sample rate, blocklisted callsites should be blocked
            assert TestRolloutComparator.should_check_experiment("test_blocked") is False
            # Non-blocklisted callsites should still work
            assert TestRolloutComparator.should_check_experiment("test_not_blocked") is True

    def test_mismatch_logging_allowlist(self) -> None:
        with override_options({TEST_CALLSITE_MISMATCH_LOG_ALLOWLIST_OPTION: []}):
            assert TestRolloutComparator._should_log_mismatch("callsite") is False

        with override_options({TEST_CALLSITE_MISMATCH_LOG_ALLOWLIST_OPTION: ["callsite"]}):
            assert TestRolloutComparator._should_log_mismatch("callsite") is True
            assert TestRolloutComparator._should_log_mismatch("other") is False

        with override_options({TEST_CALLSITE_MISMATCH_LOG_ALLOWLIST_OPTION: ["*"]}):
            assert TestRolloutComparator._should_log_mismatch("callsite") is True
            assert TestRolloutComparator._should_log_mismatch("other") is True

    def test_experimental_data_use(self) -> None:
        with override_options(
            {
                TEST_CALLSITE_USE_EXPERIMENTAL_DATA_ALLOWLIST_OPTION: ["known_good_callsite"],
            }
        ):
            assert TestRolloutComparator.check_and_choose("ctl", "exp", "test_3") == "ctl"
            assert (
                TestRolloutComparator.check_and_choose("ctl", "exp", "known_good_callsite") == "exp"
            )

    def test_comparator_use(self) -> None:
        exact_matcher = lambda control, exp: exp["dogs"] == control["dogs"]
        close_matcher = lambda control, exp: exp["dogs"].issubset(control["dogs"])
        expected_tags = {
            "rollout_name": "test_rollout",
            "callsite": "dogs_are_great",
            "source_of_truth": "neither",
        }

        with patch("sentry.utils.rollout.metrics.incr") as mock_metrics_incr:
            TestRolloutComparator.compare(
                control_data={"dogs": {"maisey"}},
                experimental_data={"dogs": {"maisey"}},
                callsite="dogs_are_great",
                exact_match_comparator=exact_matcher,
            )
            mock_metrics_incr.assert_called_with(
                "SafeRolloutComparator.compare",
                sample_rate=0.1,
                tags={**expected_tags, "exact_match": "True"},
            )

        with patch("sentry.utils.rollout.metrics.incr") as mock_metrics_incr:
            TestRolloutComparator.compare(
                control_data={"dogs": {"charlie"}},
                experimental_data={"dogs": {"maisey"}},
                callsite="dogs_are_great",
                exact_match_comparator=exact_matcher,
            )
            mock_metrics_incr.assert_called_with(
                "SafeRolloutComparator.compare",
                sample_rate=0.1,
                tags={**expected_tags, "exact_match": "False"},
            )

        with patch("sentry.utils.rollout.metrics.incr") as mock_metrics_incr:
            TestRolloutComparator.compare(
                control_data={"dogs": {"charlie", "maisey"}},
                experimental_data={"dogs": {"maisey"}},
                callsite="dogs_are_great",
                exact_match_comparator=exact_matcher,
                reasonable_match_comparator=close_matcher,
            )
            mock_metrics_incr.assert_called_with(
                "SafeRolloutComparator.compare",
                sample_rate=0.1,
                tags={**expected_tags, "exact_match": "False", "reasonable_match": "True"},
            )

    @patch("sentry.utils.rollout.SafeRolloutComparator.check_and_choose", return_value="control")
    def test_check_and_choose_with_timings_forwards_debug_args(
        self, mock_check_and_choose: MagicMock
    ) -> None:
        serializer = lambda value: {"value": str(value)}

        with override_options({TEST_SHOULD_RUN_EXPERIMENT_OPTION: True}):
            TestRolloutComparator.check_and_choose_with_timings(
                control_data_func=lambda: "control",
                experimental_data_func=lambda: "experimental",
                callsite="test_callsite",
                debug_context={"x": "y"},
                data_serializer=serializer,
            )

        assert mock_check_and_choose.called
        assert mock_check_and_choose.call_args.kwargs["debug_context"] == {"x": "y"}
        assert mock_check_and_choose.call_args.kwargs["data_serializer"] is serializer
