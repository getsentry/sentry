from sentry.utils.rollout import SafeRolloutComparator

# TODO: When this experiment is over and we're deleting this class, go remove the check for
# `use_legacy_comparison_metric_name` in `SafeRolloutComparator.compare`.


class EAPOccurrencesComparator(SafeRolloutComparator):
    ROLLOUT_NAME = "occurrences_on_eap"
    # NOTE: Shim to not break existing dashboards. Don't use in new comparators!
    use_legacy_comparison_metric_name = True


EAP_OCCURRENCES_SHOULD_RUN_EXPERIMENT_OPTION = (
    EAPOccurrencesComparator._should_run_experiment_option()
)
EAP_OCCURRENCES_USE_EXPERIMENTAL_DATA_ALLOWLIST_OPTION = (
    EAPOccurrencesComparator._callsite_use_experimental_data_allowlist_option()
)
