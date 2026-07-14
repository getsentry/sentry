import logging
import random
from collections.abc import Callable
from typing import Any, Literal, TypeVar

from sentry import options
from sentry.options import register
from sentry.options.manager import (
    FLAG_ALLOW_EMPTY,
    FLAG_AUTOMATOR_MODIFIABLE,
    FLAG_MODIFIABLE_BOOL,
    FLAG_MODIFIABLE_RATE,
)
from sentry.utils import metrics
from sentry.utils.safe import trim
from sentry.utils.sdk import sdk_logger
from sentry.utils.types import Bool, Dict, Float, Sequence

logger = logging.getLogger(__name__)

TData = TypeVar("TData")  # The type of data being compared

SourceOfTruth = Literal["control", "experimental", "neither", "both"]


class SafeRolloutComparator:
    """
    SafeRolloutComparator is a tool designed to help you roll out a change to existing logic safely.

    In particular, it can (with callsite-by-callsite granularity) help to track rate at which the
    experimental branch both exactly matches and "reasonably" matches the control branch. (What
    counts as an exact match and as a "reasonable" (close enough) match is definable by providing a
    callback for each comparison.)

    Once a callsite looks correct enough, you can switch the code behavior to actually use the data
    from the experimental branch by adding the callsite indentifier to the "use experimental data"
    allowlist option provided by the class. It's also possible to run the comparison separate from
    choosing which data to use, by using the `compare` method.

    The flow is generally:
      1. Set up your `SafeRolloutComparator` subclass (in Sentry) & options (in options automator).
      2. Use the comparator in your first callsite (see example below). (More callsites can be added
         at any time.)
      3. Start rolling out the experiment by switching the "should run experiment" option to True
         and, if you've set a sample rate option, increasing the sample rate. (If not set, the
         sample rate defaults to 100%.)
      4. Monitor correctness using the metrics and optional mismatch logs emitted when the
         experimental branch is run.
      5. Start adding known-good callsites to the "use experimental data" allowlist.
      6. Complete your migration, secure in your knowledge that it's safe to do so.
      7. Clean up your control branch & `SafeRolloutComparator` when you're done. Success!

    Used like:
    ```
    # Setup
    class FooComparator(SafeRolloutComparator):
        ROLLOUT_NAME="some_new_feature"

    # Example callsite:
    def some_function():
        # ...

        # A unique identifier for the callsite, for option names and metrics/logs tagging
        callsite = "some.module.path.some_function"

        control_data = old_slow_trustworthy_method()
        if FooComparator.should_check_experiment(callsite):
            experimental_data = new_fast_risky_method()
            data = FooComparator.check_and_choose(
                control_data,
                experimental_data,
                callsite,
                is_experimental_data_nullish=len(experimental_data) == 0,
                reasonable_match_comparator=lambda ctl, exp: exp.issubset(ctl)
            )
        else:
            data = control_data
    ```

    In options-automator:
    ```
    dynamic.saferollouts.some_new_feature.should_eval_experimental: True
    dynamic.saferollouts.some_new_feature.callsite_experiment_sample_rate:
      { "some.module.path.some_function": 0.0001 }
    dynamic.saferollouts.some_new_feature.eval_experimental_sample_rate: 0.0001 # Fallback rate
    dynamic.saferollouts.some_new_feature.mismatch_log_callsite_allowlist:
      ["*"] # Log mismatches for all callsites
    ```
    """

    # This identifies your overall rollout, and is used in option names and metrics/log tagging
    ROLLOUT_NAME: str
    # Whether to log using the regular Python logger (which logs to both GCP and Sentry), or the SDK
    # logger (which logs only to Sentry). Useful for situations where mismatch logs might include
    # customer data. Defaults to False (meaning the Python logger is used).
    internal_logs_only: bool = False
    # Custom serializer to use when logging control and experimental data in cases where they don't
    # match. Can also be passed directly to `compare`, `check_and_choose`, and
    # `check_and_choose_with_timings` for callsite-specific serialization.
    data_serializer: Callable[[TData], Any] | None = None

    @classmethod
    def _should_run_experiment_option(cls) -> str:
        """
        This is the high-level experiment rollout option. If this option is disabled (the default),
        the `should_check_experiment` function will return False.
        """
        return f"dynamic.saferollouts.{cls.ROLLOUT_NAME}.should_eval_experimental"

    @classmethod
    def _experiment_sample_rate_option(cls) -> str:
        """
        This is the sample rate for evaluating the experimental branch. When set to a value less
        than 1.0, only that percentage of requests will actually evaluate both branches. This is
        useful for limiting latency impact on high-traffic callsites while still collecting
        representative metrics. Default is 1.0 (100% of requests are evaluated).
        """
        return f"dynamic.saferollouts.{cls.ROLLOUT_NAME}.eval_experimental_sample_rate"

    @classmethod
    def _callsite_sample_rate_option(cls) -> str:
        """
        This is a dictionary specifying a per-callsite sample rate for evaluating the experimental
        branch. For a given callsite, when set to a value less than 1.0, only that percentage of
        requests will actually evaluate both branches. This is useful for limiting latency impact on
        high-traffic callsites while still collecting representative metrics. Defaults to an empty
        dictionary.

        NOTE: If a callsite is listed here, its sample rate will be used instead of the experiment-
        wide sample rate. Any callsite which isn't included will use the experiment-wide rate.
        """
        return f"dynamic.saferollouts.{cls.ROLLOUT_NAME}.callsite_experiment_sample_rate"

    @classmethod
    def _callsite_experiment_blocklist_option(cls) -> str:
        """
        This is a list containing callsites for which the experiment shouldn't be run; if the option
        value contains a callsite, the `should_check_experiment` function will return False. (This
        is useful if you see one callsite in particular start throwing.) Defaults to an empty list.
        """
        return f"dynamic.saferollouts.{cls.ROLLOUT_NAME}.eval_callsite_blocklist"

    @classmethod
    def _callsite_mismatch_log_allowlist_option(cls) -> str:
        """
        Controls which callsites emit structured mismatch logs. Add a callsite identifier to enable
        logging for it, or set the option to `["*"]` to enable logging for all callsites. Defaults
        to an empty list (no mismatch logging).
        """
        return f"dynamic.saferollouts.{cls.ROLLOUT_NAME}.mismatch_log_callsite_allowlist"

    @classmethod
    def _callsite_use_experimental_data_allowlist_option(cls) -> str:
        """
        This is the callsite-level use-experimental-path rollout option. If the option value
        contains a callsite, then that callsite will use the experimental-path data. This should
        generally only be used once you've determined that there is a high rate of partial- or
        exact- match at the callsite. Defaults to an empty list.
        """
        return f"dynamic.saferollouts.{cls.ROLLOUT_NAME}.use_experimental_data_callsite_allowlist"

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)

        register(
            cls._should_run_experiment_option(),
            type=Bool,
            default=False,
            flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
        )
        register(
            cls._experiment_sample_rate_option(),
            type=Float,
            default=1.0,
            flags=FLAG_MODIFIABLE_RATE | FLAG_AUTOMATOR_MODIFIABLE,
        )
        register(
            cls._callsite_sample_rate_option(),
            type=Dict,
            default={},
            flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
        )
        register(
            cls._callsite_experiment_blocklist_option(),
            type=Sequence,
            default=[],
            flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
        )
        register(
            cls._callsite_use_experimental_data_allowlist_option(),
            type=Sequence,
            default=[],
            flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
        )
        register(
            cls._callsite_mismatch_log_allowlist_option(),
            type=Sequence,
            default=[],
            flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
        )

    @classmethod
    def _should_log_mismatch(cls, callsite: str) -> bool:
        allowlist = set(options.get(cls._callsite_mismatch_log_allowlist_option()))
        return "*" in allowlist or callsite in allowlist

    @classmethod
    def _default_serialize_for_log(cls, value: Any) -> Any:
        # The internal-only logger handles serialization itself
        if cls.internal_logs_only:
            return value

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
        source_of_truth: SourceOfTruth,
        is_exact_match: bool,
        is_reasonable_match: bool | None,
        is_experimental_data_nullish: bool | None,
        control_data: TData,
        experimental_data: TData,
        debug_context: dict[str, Any] | None,
        data_serializer: Callable[[TData], Any] | None,
    ) -> None:
        if not cls._should_log_mismatch(callsite):
            return

        serialize = (
            data_serializer
            or cls.data_serializer
            # For comparators using internal logs only, `_default_serialize_for_log` is a
            # pass-through, since our SDK logging wrapper (which internal-only comparators use for
            # logging) handles serialization itself. For comparators using the Python logger, it
            # preserves structure but stringifies values of unknown types.
            or cls._default_serialize_for_log
        )

        base_logging_data = {
            "rollout_name": cls.ROLLOUT_NAME,
            "callsite": callsite,
            "source_of_truth": source_of_truth,
            "exact_match": is_exact_match,
            "reasonable_match": is_reasonable_match,
            "is_null_result": is_experimental_data_nullish,
            "debug_context": cls._default_serialize_for_log(debug_context),
            "control_data_raw": serialize(control_data),
            "experimental_data_raw": serialize(experimental_data),
        }

        if cls.internal_logs_only:
            sdk_logger.info("saferollout.mismatch", attributes=base_logging_data)
        else:
            logger.info(
                "saferollout.mismatch",
                extra={
                    **base_logging_data,
                    # Trimming has to be handled here rather than in `_default_serialize_for_log`
                    # because the latter is recursive, and we only want to trim at the end.
                    "debug_context": trim(base_logging_data["debug_context"]),
                    "control_data_raw": trim(base_logging_data["control_data_raw"]),
                    "experimental_data_raw": trim(base_logging_data["experimental_data_raw"]),
                },
            )

    @classmethod
    def _is_valid_sample_rate(cls, value: Any) -> bool:
        """
        Checks to make sure the sample rate is valid (a number between 0 and 1) and logs a warning
        if it's not.
        """
        rate_is_numeric = (
            isinstance(value, (int, float))
            # Bools are technically special cases of int
            and not isinstance(value, bool)
        )
        if not rate_is_numeric or not (0 <= value <= 1):
            logger.warning(
                "saferollout.invalid_callsite_sample_rate",
                extra={
                    "rollout_name": cls.ROLLOUT_NAME,
                    "value": cls._default_serialize_for_log(value),
                },
            )
            return False

        return True

    @classmethod
    def should_check_experiment(cls, callsite: str) -> bool:
        """
        This function controls whether you evaluate your experimental branch at all. Useful for
        rolling out by region or blocklisting callsites that throw.

        The check includes:
        1. Global eval option must be enabled
        2. Callsite must not be in the blocklist
        3. Random sampling based on the sample_rate option (default 1.0 = 100%)
        """
        if not options.get(cls._should_run_experiment_option()):
            return False

        if callsite in options.get(cls._callsite_experiment_blocklist_option()):
            return False

        callsite_sample_rates = options.get(cls._callsite_sample_rate_option())  # Defaults to {}
        if callsite in callsite_sample_rates and cls._is_valid_sample_rate(
            callsite_sample_rates[callsite]
        ):
            sample_rate = callsite_sample_rates[callsite]
        else:
            # We don't need to validate this value, because options automator does it for us - it
            # just can't validate values inside a dictionary, hence the check above
            sample_rate = options.get(cls._experiment_sample_rate_option())  # Defaults to 1.0

        return random.random() < sample_rate

    @classmethod
    def should_use_experimental_data(cls, callsite: str) -> bool:
        """
        This function controls whether you use the result of your experimental data. Useful for
        allowlisting known-safe callsites.

        Note: If you are transitioning from an existing, intended-to-be-equivalent dataset, you
        should instead use `check_and_choose` (which has this check built in and has better
        logging).
        """
        use_experimental_data = callsite in options.get(
            cls._callsite_use_experimental_data_allowlist_option()
        )
        tags: dict[str, str] = {
            "rollout_name": cls.ROLLOUT_NAME,
            "callsite": callsite,
            "use_experimental": ("true" if use_experimental_data else "false"),
        }
        metrics.incr(
            "SafeRolloutComparator.should_use_experiment",
            tags=tags,
        )
        return use_experimental_data

    @classmethod
    def compare(
        cls,
        control_data: TData,
        experimental_data: TData,
        callsite: str,
        source_of_truth: SourceOfTruth = "neither",
        is_experimental_data_nullish: bool | None = None,
        exact_match_comparator: Callable[[TData, TData], bool] | None = None,
        reasonable_match_comparator: Callable[[TData, TData], bool] | None = None,
        debug_context: dict[str, Any] | None = None,
        data_serializer: Callable[[TData], Any] | None = None,
        metric_sample_rate: float = 0.1,
    ) -> None:
        """
        Compare control & experimental data, emit metrics, and log mismatches. Use this directly
        (rather than `check_and_choose`) if you don't need help determining which data to use
        downstream - e.g. if you won't be using either branch's data, or if you'll be using both.

        Inputs:
        * control_data: Some data from the control branch (e.g. dict[str, str])
        * experimental_data: Some data from the experimental branch (of same type as control)
        * callsite: A unique string identifying place that uses this class. Should be the same as
            what's passed to `should_check_experiment`.
        * source_of_truth: Which branch's data the caller will actually use downstream. Defaults to
            "neither" (the typical direct-call case). `check_and_choose` passes "control" or
            "experimental" based on the use-experimental-data allowlist; callers using both branches
            should pass "both".
        * is_experimental_data_nullish: Whether the result is a "null result" (e.g. empty array).
            This helps to determine whether a "match" is significant.
        * exact_match_comparator: Optional function to determine if the control data and
            experimental data are considered a match. If not provided, strict equality will be used.
        * reasonable_match_comparator: Optional function to determine if the control data and
            experimental data are "reasonably the same." An example might be checking whether the
            experimental data is a subset of the control data (useful in case of migrating something
            where you don't yet have full retention in the experimental branch). If not provided, no
            "reasonable match" comparison will be performed.
        * debug_context: Optional structured metadata included on mismatch logs.
        * data_serializer: Optional serializer for control/experimental payloads in logs. Defaults
            to `_default_serialize_for_log`.
        * metric_sample_rate: Optional override for the sample rate of the comparison metric.
        """
        is_exact_match = control_data == experimental_data
        is_reasonable_match: bool | None = None

        tags: dict[str, str] = {
            "rollout_name": cls.ROLLOUT_NAME,
            "callsite": callsite,
            "exact_match": str(is_exact_match),
            "source_of_truth": source_of_truth,
        }

        if is_experimental_data_nullish is not None:
            tags["is_null_result"] = str(is_experimental_data_nullish)

        if exact_match_comparator is not None:
            try:
                is_exact_match = exact_match_comparator(control_data, experimental_data)
            except Exception:
                logger.exception(
                    "saferollout.exact_match_comparator_error",
                    extra={"rollout_name": cls.ROLLOUT_NAME, "callsite": callsite},
                )
                is_exact_match = control_data == experimental_data
            else:
                tags["exact_match"] = str(is_exact_match)

        if reasonable_match_comparator is not None:
            try:
                is_reasonable_match = reasonable_match_comparator(control_data, experimental_data)
            except Exception:
                logger.exception(
                    "saferollout.reasonable_match_comparator_error",
                    extra={"rollout_name": cls.ROLLOUT_NAME, "callsite": callsite},
                )
                is_reasonable_match = None
            else:
                tags["reasonable_match"] = str(is_reasonable_match)

        # Log mismatch only for true mismatches: when a reasonable comparator
        # exists, only log if it returned False; otherwise log on exact mismatch.
        has_mismatch = is_reasonable_match is False or (
            is_reasonable_match is None and is_exact_match is False
        )
        if has_mismatch:
            try:
                cls._maybe_log_mismatch(
                    callsite=callsite,
                    source_of_truth=source_of_truth,
                    is_exact_match=is_exact_match,
                    is_reasonable_match=is_reasonable_match,
                    is_experimental_data_nullish=is_experimental_data_nullish,
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

        # TODO: This shim is only used in `EAPOccurrencesComparator`. Once that's deleted, this
        # check can go away and we can standardize on emitting just the `compare` metric.
        if getattr(cls, "use_legacy_comparison_metric_name", None):
            metrics.incr("SafeRolloutComparator.check_and_choose", tags=tags)
        else:
            metrics.incr("SafeRolloutComparator.compare", sample_rate=metric_sample_rate, tags=tags)

    @classmethod
    def check_and_choose(
        cls,
        control_data: TData,
        experimental_data: TData,
        callsite: str,
        is_experimental_data_nullish: bool | None = None,
        exact_match_comparator: Callable[[TData, TData], bool] | None = None,
        reasonable_match_comparator: Callable[[TData, TData], bool] | None = None,
        debug_context: dict[str, Any] | None = None,
        data_serializer: Callable[[TData], Any] | None = None,
        metric_sample_rate: float = 0.1,
    ) -> TData:
        """
        Compare control & experimental data (via `compare`), then return whichever branch should be
        used downstream based on the use-experimental-data allowlist.

        See `compare` for parameter documentation.
        """
        use_experimental_data = cls.should_use_experimental_data(callsite)
        cls.compare(
            control_data=control_data,
            experimental_data=experimental_data,
            callsite=callsite,
            source_of_truth="experimental" if use_experimental_data else "control",
            is_experimental_data_nullish=is_experimental_data_nullish,
            exact_match_comparator=exact_match_comparator,
            reasonable_match_comparator=reasonable_match_comparator,
            debug_context=debug_context,
            data_serializer=data_serializer,
            metric_sample_rate=metric_sample_rate,
        )
        return experimental_data if use_experimental_data else control_data

    @classmethod
    def check_and_choose_with_timings(
        cls,
        control_data_func: Callable[[], TData],
        experimental_data_func: Callable[[], TData],
        callsite: str,
        null_result_determiner: Callable[[TData], bool] | None = None,
        exact_match_comparator: Callable[[TData, TData], bool] | None = None,
        reasonable_match_comparator: Callable[[TData, TData], bool] | None = None,
        debug_context: dict[str, Any] | None = None,
        data_serializer: Callable[[TData], Any] | None = None,
        metric_sample_rate: float = 0.1,
    ) -> TData:
        """
        This method is a wrapper for `check_and_choose` which also captures timing information for
        the control/experimental branches. To enable that, instead of taking the control and
        experimental values, it instead takes callbacks which calculate them. It also takes a
        callback for determining if the experimental result is nullish, rather than a boolean. All
        other parameters match those of `check_and_choose`.
        """
        # Insurance - this should already have been checked by the caller
        if not cls.should_check_experiment(callsite):
            # Don't bother collecting data if we're only evaluating the control branch
            return control_data_func()

        with metrics.timer(
            "SafeRolloutComparator.check_and_choose_with_timings",
            sample_rate=metric_sample_rate,
            tags={
                "rollout_name": cls.ROLLOUT_NAME,
                "callsite": callsite,
                "branch": "control",
            },
        ):
            control_data = control_data_func()

        with metrics.timer(
            "SafeRolloutComparator.check_and_choose_with_timings",
            sample_rate=metric_sample_rate,
            tags={
                "rollout_name": cls.ROLLOUT_NAME,
                "callsite": callsite,
                "branch": "experimental",
            },
        ):
            experimental_data = experimental_data_func()

        is_experimental_data_nullish = None
        if null_result_determiner is not None:
            is_experimental_data_nullish = null_result_determiner(experimental_data)

        return cls.check_and_choose(
            control_data=control_data,
            experimental_data=experimental_data,
            callsite=callsite,
            is_experimental_data_nullish=is_experimental_data_nullish,
            exact_match_comparator=exact_match_comparator,
            reasonable_match_comparator=reasonable_match_comparator,
            debug_context=debug_context,
            data_serializer=data_serializer,
            metric_sample_rate=metric_sample_rate,
        )
