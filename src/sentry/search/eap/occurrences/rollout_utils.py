from sentry.utils.rollout import SafeRolloutComparator


class EAPOccurrencesComparator(SafeRolloutComparator):
    ROLLOUT_NAME = "occurrences_on_eap"
