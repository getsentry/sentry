from collections.abc import Callable
from typing import Any, TypeVar

from sentry import options
from sentry.utils import metrics

TData = TypeVar("TData")

from sentry.options.manager import FLAG_ALLOW_EMPTY, FLAG_AUTOMATOR_MODIFIABLE, FLAG_MODIFIABLE_BOOL
from sentry.utils.types import Bool, Sequence


class SafeRolloutComparator:
    """
    SafeRolloutComparator is a tool designed to help you roll out a change to existing logic safely.

    In particular, it can (at a callsite-by-callsite granularity) help to track both the
    _exact_ and _reasonable_ rate at which the experimental branch matches the control branch.
    Once a callsite looks correct enough, you can switch the code behavior to actually use the
    data from the experimental branch.

    The flow is generally:
      1. Set up your SafeRolloutComparator class & options.
      2. Add your first callsite. (Further callsites can be added at any time.)
      3. Start rolling out the "evaluate experimental branch" option.
      4. Monitor correctness through standard dashboard. (TODO @cpaul: build dashboard)
      5. Start adding known-good callsites to the "use experimental branch" allowlist.
      6. Complete your migration, secure in your knowledge that it's safe to do so.
      7. Clean up your control branch & SafeRolloutComparator when you're done. Success!

    Used like:
    ```python
    callsite = "BarClass::baz"
    control_data = old_slow_trustworthy_method()
    if FooComparator.should_check_experiment(callsite):
        experimental_data = new_fast_risky_method()
        data = FooComparator.check_and_choose(
            control_data,
            experimental_data,
            callsite,
            len(experimental_data) == 0,
            lambda ctl, exp: exp.issubset(ctl)
        )
    else:
        data = control_data
    ```
    """

    # This is your rollout, which determines your option names and which you can filter
    # the DataDog dashboards to show.
    # TODO @cpaul: construct DataDog dashboards once you have a rollout using this.
    ROLLOUT_NAME: str

    @classmethod
    def _should_eval_option_name(cls) -> str:
        """
        This is the high-level eval rollout option. If this option is disabled, the
        should_check_experiment function will return False.
        """
        return f"dynamic.saferollouts.{cls.ROLLOUT_NAME}.should_eval_experimental"

    @classmethod
    def _callsite_blocklist_option_name(cls) -> str:
        """
        This is the callsite-level eval rollout option. If the option contains a callsite,
        the should_check_experiment function will return False. (This is useful if you see
        one callsite in particular start throwing.)
        """
        return f"dynamic.saferollouts.{cls.ROLLOUT_NAME}.eval_callsite_blocklist"

    @classmethod
    def _callsite_allowlist_option_name(cls) -> str:
        """
        This is the callsite-level use-experimental-path rollout option. If the option
        contains a callsite, then that callsite will use the experimental-path data.
        This should generally only be used once you've determined that there is a high
        rate of partial- or exact- match at the callsite.
        """
        return f"dynamic.saferollouts.{cls.ROLLOUT_NAME}.use_experimental_data_callsite_allowlist"

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        from sentry.options import register

        register(
            cls._should_eval_option_name(),
            type=Bool,
            default=False,
            flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
        )
        register(
            cls._callsite_blocklist_option_name(),
            type=Sequence,
            default=[],
            flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
        )
        register(
            cls._callsite_allowlist_option_name(),
            type=Sequence,
            default=[],
            flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
        )

    @classmethod
    def should_check_experiment(cls, callsite: str) -> bool:
        """
        This function should control whether you evaluate your experimental branch at
        all. Useful for rolling out by region or blocklisting callsites that throw.
        """
        if not options.get(cls._should_eval_option_name()):
            return False

        return callsite not in options.get(cls._callsite_blocklist_option_name())

    @classmethod
    def check_and_choose(
        cls,
        control_data: TData,
        experimental_data: TData,
        callsite: str,
        is_experimental_data_a_null_result: bool | None = None,
        reasonable_match_comparator: Callable[[TData, TData], bool] | None = None,
    ) -> TData:
        """
        This function does two things.
        First, it compares control & experimental data and logs info to DataDog.
        Second, it determines which of the inputs should be returned & used downstream.

        Inputs:
        * control_data: Some data from the control branch (e.g. dict[str, str])
        * experimental_data: Some data from the experimental branch (of same type as control)
        * callsite: A unique string for each place that uses this class. Should be the
            same as passed to should_check_experiment.
        * is_null_result: Whether the result is a "null result" (e.g. empty array). This
            helps to determine whether a "match" is significant.
        * reasonable_match_comparator: None, or a function taking control_data & experimental_data and
            returning True if the read is "reasonable" and False otherwise. An example might
            be checking whether the experimental data is a subset of the control data (useful
            in case of migrating something where you don't yet have full retention in the
            experimental branch).
        """
        use_experimental = callsite in options.get(cls._callsite_allowlist_option_name())

        # Part 1: Compare & log
        tags: dict[str, str] = {
            "rollout_name": cls.ROLLOUT_NAME,
            "callsite": callsite,
            "exact_match": str(control_data == experimental_data),
            "source_of_truth": ("experimental" if use_experimental else "control"),
        }

        if is_experimental_data_a_null_result is not None:
            tags["is_null_result"] = str(is_experimental_data_a_null_result)

        if reasonable_match_comparator is not None:
            tags["reasonable_match"] = str(
                reasonable_match_comparator(control_data, experimental_data)
            )

        metrics.incr(
            "SafeRolloutComparator.check_and_choose",
            tags=tags,
        )

        # Part 2: determine what to return
        return experimental_data if use_experimental else control_data
