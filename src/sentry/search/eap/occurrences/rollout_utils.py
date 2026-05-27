from sentry.utils.rollout import SafeRolloutComparator


class EAPOccurrencesComparator(SafeRolloutComparator):
    ROLLOUT_NAME = "occurrences_on_eap"


EAP_OCCURRENCES_SHOULD_RUN_EXPERIMENT_OPTION = (
    EAPOccurrencesComparator._should_run_experiment_option()
)
EAP_OCCURRENCES_USE_EXPERIMENTAL_DATA_ALLOWLIST_OPTION = (
    EAPOccurrencesComparator._callsite_use_experimental_data_allowlist_option()
)
