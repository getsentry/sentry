from datetime import datetime

from sentry.anomaly_detection.contracts import ChangeEvent


class NoFootprints:
    """A footprint source for evaluations that need no trace evidence."""

    def footprint(self, event: ChangeEvent, observation_end: datetime, /) -> None:
        return None
