import logging
from typing import Any, Mapping, Sequence

from sentry.releasehealth.base import ReleaseHealthBackend
from sentry.releasehealth.metrics import MetricsReleaseHealthBackend
from sentry.releasehealth.sessions import SessionsReleaseHealthBackend

logger = logging.getLogger(__name__)


class DualReadReleaseHealthBackend(ReleaseHealthBackend):
    """Gets release health results from two sources and compares the results"""

    def __init__(self):
        self._backend1 = SessionsReleaseHealthBackend()
        self._backend2 = MetricsReleaseHealthBackend()

    def query(self, *args, **kwargs) -> Sequence[Mapping[str, Any]]:
        result1 = self._backend1.query(*args, **kwargs)
        try:
            result2 = self._backend2.query(*args, **kwargs)
        except Exception as exc:
            logger.exception("secondary backend threw", exc_info=exc)
        else:
            if result1 != result2:
                # TODO: find a smarter way to record these diffs
                logger.debug("results differ", result1, result2)

        return result1
