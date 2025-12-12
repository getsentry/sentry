from sentry.utils.rollout import SafeMigrationComparator


class OccurrencesOnEAPComparator(SafeMigrationComparator):
    EVAL_EXPERIMENTAL_ROLLOUT_OPTION = "rollouts.occurrences_on_eap.should_eval_experimental"
    EVAL_EXPERIMENTAL_DATA_CALLSITE_BLOCKLIST_OPTION = (
        "rollouts.occurrences_on_eap.eval_callsite_blocklist"
    )
    USE_EXPERIMENTAL_DATA_CALLSITE_ALLOWLIST_OPTION = (
        "rollouts.occurrences_on_eap.use_experimental_data_callsite_allowlist"
    )
    ROLLOUT_NAME = "occurrences_on_eap"
