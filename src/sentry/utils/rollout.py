import logging
import random
from collections.abc import Callable
from typing import Any, TypeVar

from sentry import options
from sentry.utils import metrics
from sentry.utils.safe import trim

TData = TypeVar("TData")
logger = logging.getLogger(__name__)

from sentry.options.manager import (
    FLAG_ALLOW_EMPTY,
    FLAG_AUTOMATOR_MODIFIABLE,
    FLAG_MODIFIABLE_BOOL,
    FLAG_MODIFIABLE_RATE,
)
from sentry.utils.types import Bool, Float, Sequence


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

    @classmethod
    def _sample_rate_option_name(cls) -> str:
        """
        This is the sample rate for evaluating the experimental branch. When set to a value
        less than 1.0, only that percentage of requests will actually perform the double-read.
        This is useful for limiting latency impact on high-traffic callsites while still
        collecting representative metrics. Default is 1.0 (100% of requests are evaluated).
        """
        return f"dynamic.saferollouts.{cls.ROLLOUT_NAME}.eval_experimental_sample_rate"

    @classmethod
    def _mismatch_log_callsite_allowlist_option_name(cls) -> str:
        """
        Controls which callsites emit structured mismatch logs. Add a callsite
        string to enable logging for it, or ``"*"`` to enable for all callsites.
        """
        return f"dynamic.saferollouts.{cls.ROLLOUT_NAME}.mismatch_log_callsite_allowlist"

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
        register(
            cls._sample_rate_option_name(),
            type=Float,
            default=1.0,
            flags=FLAG_MODIFIABLE_RATE | FLAG_AUTOMATOR_MODIFIABLE,
        )
        register(
            cls._mismatch_log_callsite_allowlist_option_name(),
            type=Sequence,
            default=[],
            flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
        )

    @classmethod
    def should_log_mismatch(cls, callsite: str) -> bool:
        allowlist = set(options.get(cls._mismatch_log_callsite_allowlist_option_name()))
        return "*" in allowlist or callsite in allowlist

    @classmethod
    def _default_serialize_for_log(cls, value: Any) -> Any:
        if isinstance(value, (str, int, float, bool)) or value is None:
            return value
        if isinstance(value, dict):
            return {str(k): cls._default_serialize_for_log(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [cls._default_serialize_for_log(v) for v in value]
        if isinstance(value, set):
            return [cls._default_serialize_for_log(v) for v in sorted(value, key=repr)]
        return repr(value)

    @classmethod
    def _maybe_log_mismatch(
        cls,
        *,
        callsite: str,
        use_experimental: bool,
        exact_match: bool,
        reasonable_match: bool | None,
        is_experimental_data_a_null_result: bool | None,
        control_data: TData,
        experimental_data: TData,
        debug_context: dict[str, Any] | None,
        data_serializer: Callable[[TData], Any] | None,
    ) -> None:
        if not cls.should_log_mismatch(callsite):
            return

        serialize = data_serializer or cls._default_serialize_for_log

        logger.info(
            "saferollout.mismatch",
            extra=trim(
                {
                    "rollout_name": cls.ROLLOUT_NAME,
                    "callsite": callsite,
                    "source_of_truth": ("experimental" if use_experimental else "control"),
                    "exact_match": exact_match,
                    "reasonable_match": reasonable_match,
                    "is_null_result": is_experimental_data_a_null_result,
                    "debug_context": cls._default_serialize_for_log(debug_context),
                    "control_data_raw": serialize(control_data),
                    "experimental_data_raw": serialize(experimental_data),
                }
            ),
        )

    @classmethod
    def should_check_experiment(cls, callsite: str) -> bool:
        """
        This function should control whether you evaluate your experimental branch at
        all. Useful for rolling out by region or blocklisting callsites that throw.

        The check includes:
        1. Global eval option must be enabled
        2. Callsite must not be in the blocklist
        3. Random sampling based on the sample_rate option (default 1.0 = 100%)
        """
        if not options.get(cls._should_eval_option_name()):
            return False

        if callsite in options.get(cls._callsite_blocklist_option_name()):
            return False

        sample_rate = options.get(cls._sample_rate_option_name())
        return random.random() < sample_rate

    @classmethod
    def should_use_experiment(cls, callsite: str) -> bool:
        """
        This function should control whether you use the result of your experimental
        data. Useful for allowlisting known-safe callsites.
        If you are transitioning from an existing, intended-to-be equivalent dataset,
        you should instead use check_and_choose (which standardizes the choice logic
        and has better logging).
        """
        use_experimental = callsite in options.get(cls._callsite_allowlist_option_name())
        tags: dict[str, str] = {
            "rollout_name": cls.ROLLOUT_NAME,
            "callsite": callsite,
            "use_experimental": ("true" if use_experimental else "false"),
        }
        metrics.incr(
            "SafeRolloutComparator.should_use_experiment",
            tags=tags,
        )
        return use_experimental

    @classmethod
    def check_and_choose(
        cls,
        control_data: TData,
        experimental_data: TData,
        callsite: str,
        is_experimental_data_a_null_result: bool | None = None,
        reasonable_match_comparator: Callable[[TData, TData], bool] | None = None,
        debug_context: dict[str, Any] | None = None,
        data_serializer: Callable[[TData], Any] | None = None,
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
        * reasonable_match_comparator: Optional predicate for semantic correctness
            (e.g. subset semantics with retention gaps), returning True if the read is
            "reasonable" and False otherwise. An example might be checking whether the
            experimental data is a subset of the control data (useful in case of migrating
            something where you don't yet have full retention in the experimental branch).
        * debug_context: Optional structured metadata included on mismatch logs.
        * data_serializer: Optional serializer for control/experimental payloads in
            logs. Defaults to `_default_serialize_for_log`.
        """
        use_experimental = cls.should_use_experiment(callsite)
        exact_match = control_data == experimental_data
        reasonable_match: bool | None = None

        # Part 1: Compare results, log debug info, and emit metrics
        tags: dict[str, str] = {
            "rollout_name": cls.ROLLOUT_NAME,
            "callsite": callsite,
            "exact_match": str(exact_match),
            "source_of_truth": ("experimental" if use_experimental else "control"),
        }

        if is_experimental_data_a_null_result is not None:
            tags["is_null_result"] = str(is_experimental_data_a_null_result)

        if reasonable_match_comparator is not None:
            try:
                reasonable_match = reasonable_match_comparator(control_data, experimental_data)
            except Exception:
                logger.exception(
                    "saferollout.comparator_error",
                    extra={"rollout_name": cls.ROLLOUT_NAME, "callsite": callsite},
                )
                reasonable_match = None
            else:
                tags["reasonable_match"] = str(reasonable_match)

        # Log mismatch only for true mismatches: when a reasonable comparator
        # exists, only log if it returned False; otherwise log on exact mismatch.
        has_mismatch = reasonable_match is False or (
            reasonable_match is None and exact_match is False
        )
        if has_mismatch:
            try:
                cls._maybe_log_mismatch(
                    callsite=callsite,
                    use_experimental=use_experimental,
                    exact_match=exact_match,
                    reasonable_match=reasonable_match,
                    is_experimental_data_a_null_result=is_experimental_data_a_null_result,
                    control_data=control_data,
                    experimental_data=experimental_data,
                    debug_context=debug_context,
                    data_serializer=data_serializer,
                )
            except Exception:
                logger.exception(
                    "saferollout.logging_error",
                    extra={"rollout_name": cls.ROLLOUT_NAME, "callsite": callsite},
                )

        metrics.incr(
            "SafeRolloutComparator.check_and_choose",
            tags=tags,
        )

        # Part 2: determine which data to return
        return experimental_data if use_experimental else control_data

    @classmethod
    def check_and_choose_with_timings(
        cls,
        control_thunk: Callable[[], TData],
        experimental_thunk: Callable[[], TData],
        callsite: str,
        null_result_determiner: Callable[[TData], bool] | None = None,
        reasonable_match_comparator: Callable[[TData, TData], bool] | None = None,
        debug_context: dict[str, Any] | None = None,
        data_serializer: Callable[[TData], Any] | None = None,
    ) -> TData:
        """
        This method is essentially the same as check_and_choose, but captures timing
        information around the control/experimental branches.

        This information is captured with Sentry spans, not in Datadog.
        """
        if not cls.should_check_experiment(callsite):
            # Don't bother collecting data in the case where we're only evaluating the
            # control branch.
            return control_thunk()

        with metrics.timer(
            "SafeRolloutComparator.check_and_choose_with_timings",
            tags={
                "rollout_name": cls.ROLLOUT_NAME,
                "callsite": callsite,
                "branch": "control",
            },
        ):
            control_data = control_thunk()

        with metrics.timer(
            "SafeRolloutComparator.check_and_choose_with_timings",
            tags={
                "rollout_name": cls.ROLLOUT_NAME,
                "callsite": callsite,
                "branch": "experimental",
            },
        ):
            experimental_data = experimental_thunk()

        is_experimental_data_a_null_result = None
        if null_result_determiner is not None:
            is_experimental_data_a_null_result = null_result_determiner(experimental_data)

        return cls.check_and_choose(
            control_data=control_data,
            experimental_data=experimental_data,
            callsite=callsite,
            is_experimental_data_a_null_result=is_experimental_data_a_null_result,
            reasonable_match_comparator=reasonable_match_comparator,
            debug_context=debug_context,
            data_serializer=data_serializer,
        )
