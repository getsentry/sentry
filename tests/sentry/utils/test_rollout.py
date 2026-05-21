from unittest import TestCase
from unittest.mock import MagicMock, patch

from sentry.options import all as all_options
from sentry.testutils.helpers import override_options
from sentry.utils.rollout import SafeRolloutComparator


class TestRolloutComparator(SafeRolloutComparator):
    ROLLOUT_NAME = "test_rollout"


TEST_SHOULD_RUN_EXPERIMENT_OPTION = TestRolloutComparator._should_run_experiment_option()
TEST_EXPERIMENT_SAMPLE_RATE_OPTION = TestRolloutComparator._experiment_sample_rate_option()
TEST_CALLSITE_USE_EXPERIMENTAL_DATA_ALLOWLIST_OPTION = (
    TestRolloutComparator._callsite_use_experimental_data_allowlist_option()
)
TEST_CALLSITE_EXPERIMENT_BLOCKLIST_OPTION = (
    TestRolloutComparator._callsite_experiment_blocklist_option()
)
TEST_CALLSITE_MISMATCH_LOG_ALLOWLIST_OPTION = (
    TestRolloutComparator._callsite_mismatch_log_allowlist_option()
)


class SafeRolloutComparatorTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.comp = TestRolloutComparator()

    def test_options_registered(self) -> None:
        option_names = [o.name for o in all_options()]

        assert TEST_SHOULD_RUN_EXPERIMENT_OPTION in option_names
        assert TEST_CALLSITE_USE_EXPERIMENTAL_DATA_ALLOWLIST_OPTION in option_names
        assert TEST_CALLSITE_EXPERIMENT_BLOCKLIST_OPTION in option_names
        assert TEST_EXPERIMENT_SAMPLE_RATE_OPTION in option_names
        assert TEST_CALLSITE_MISMATCH_LOG_ALLOWLIST_OPTION in option_names

    def test_return_as_expected(self) -> None:
        with override_options({TEST_SHOULD_RUN_EXPERIMENT_OPTION: False}):
            assert TestRolloutComparator.should_check_experiment("test_1") is False

        with override_options(
            {
                TEST_SHOULD_RUN_EXPERIMENT_OPTION: True,
                TEST_CALLSITE_EXPERIMENT_BLOCKLIST_OPTION: ["test_blocked"],
                TEST_EXPERIMENT_SAMPLE_RATE_OPTION: 1.0,
            }
        ):
            assert TestRolloutComparator.should_check_experiment("test_2") is True
            assert TestRolloutComparator.should_check_experiment("test_blocked") is False

        with override_options(
            {
                TEST_CALLSITE_USE_EXPERIMENTAL_DATA_ALLOWLIST_OPTION: ["test_allowed"],
                TEST_CALLSITE_MISMATCH_LOG_ALLOWLIST_OPTION: [],
            }
        ):
            assert TestRolloutComparator.check_and_choose("ctl", "exp", "test_3") == "ctl"
            assert TestRolloutComparator.check_and_choose("ctl", "exp", "test_allowed") == "exp"

    def test_eval_experimental_sample_rate(self) -> None:
        with override_options(
            {
                TEST_SHOULD_RUN_EXPERIMENT_OPTION: True,
                TEST_CALLSITE_EXPERIMENT_BLOCKLIST_OPTION: [],
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

    def test_eval_experimental_respects_blocklist(self) -> None:
        with override_options(
            {
                TEST_SHOULD_RUN_EXPERIMENT_OPTION: True,
                TEST_CALLSITE_EXPERIMENT_BLOCKLIST_OPTION: ["test_blocked"],
                TEST_EXPERIMENT_SAMPLE_RATE_OPTION: 1.0,
            }
        ):
            # Even with 100% sample rate, blocklisted callsites should be blocked
            assert TestRolloutComparator.should_check_experiment("test_blocked") is False
            # Non-blocklisted callsites should still work
            assert TestRolloutComparator.should_check_experiment("test_not_blocked") is True

    def test_eval_experimental_sample_rate_respects_eval_disabled(self) -> None:
        with override_options(
            {
                TEST_SHOULD_RUN_EXPERIMENT_OPTION: False,
                TEST_CALLSITE_EXPERIMENT_BLOCKLIST_OPTION: [],
                TEST_EXPERIMENT_SAMPLE_RATE_OPTION: 1.0,
            }
        ):
            assert TestRolloutComparator.should_check_experiment("test_disabled") is False

    def test_should_log_mismatch_allowlist(self) -> None:
        with override_options({TEST_CALLSITE_MISMATCH_LOG_ALLOWLIST_OPTION: []}):
            assert TestRolloutComparator._should_log_mismatch("callsite") is False

        with override_options({TEST_CALLSITE_MISMATCH_LOG_ALLOWLIST_OPTION: ["callsite"]}):
            assert TestRolloutComparator._should_log_mismatch("callsite") is True
            assert TestRolloutComparator._should_log_mismatch("other") is False

        with override_options({TEST_CALLSITE_MISMATCH_LOG_ALLOWLIST_OPTION: ["*"]}):
            assert TestRolloutComparator._should_log_mismatch("callsite") is True
            assert TestRolloutComparator._should_log_mismatch("other") is True

    @patch("sentry.utils.rollout.SafeRolloutComparator.check_and_choose")
    def test_check_and_choose_with_timings_forwards_debug_args(
        self, check_and_choose: MagicMock
    ) -> None:
        check_and_choose.return_value = "control"
        serializer = lambda value: {"value": str(value)}

        with override_options(
            {
                TEST_SHOULD_RUN_EXPERIMENT_OPTION: True,
                TEST_CALLSITE_EXPERIMENT_BLOCKLIST_OPTION: [],
                TEST_EXPERIMENT_SAMPLE_RATE_OPTION: 1.0,
            }
        ):
            TestRolloutComparator.check_and_choose_with_timings(
                control_data_func=lambda: "control",
                experimental_data_func=lambda: "experimental",
                callsite="test_callsite",
                debug_context={"x": "y"},
                data_serializer=serializer,
            )

        assert check_and_choose.called
        assert check_and_choose.call_args.kwargs["debug_context"] == {"x": "y"}
        assert check_and_choose.call_args.kwargs["data_serializer"] is serializer
