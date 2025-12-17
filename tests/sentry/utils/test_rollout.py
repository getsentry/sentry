from unittest import TestCase

from sentry.options import all as all_options
from sentry.testutils.helpers import override_options
from sentry.utils.rollout import SafeRolloutComparator


class TestRolloutComparator(SafeRolloutComparator):
    ROLLOUT_NAME = "test_rollout"


class SafeRolloutComparatorTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.comp = TestRolloutComparator()

    def test_options_registered(self) -> None:
        option_names = [o.name for o in all_options()]

        assert TestRolloutComparator._should_eval_option_name() in option_names
        assert TestRolloutComparator._callsite_allowlist_option_name() in option_names
        assert TestRolloutComparator._callsite_blocklist_option_name() in option_names

    def test_return_as_expected(self) -> None:
        with override_options({TestRolloutComparator._should_eval_option_name(): False}):
            assert TestRolloutComparator.should_check_experiment("test_1") is False

        with override_options(
            {
                TestRolloutComparator._should_eval_option_name(): True,
                TestRolloutComparator._callsite_blocklist_option_name(): ["test_blocked"],
            }
        ):
            assert TestRolloutComparator.should_check_experiment("test_2") is True
            assert TestRolloutComparator.should_check_experiment("test_blocked") is False

        with override_options(
            {
                TestRolloutComparator._callsite_allowlist_option_name(): ["test_allowed"],
            }
        ):
            assert TestRolloutComparator.check_and_choose("ctl", "exp", "test_3") == "ctl"
            assert TestRolloutComparator.check_and_choose("ctl", "exp", "test_allowed") == "exp"
