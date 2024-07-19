from typing import Any

from sentry.buffer.base import Buffer
from sentry.db import models


class InProcessBuffer(Buffer):
    """
    In-process buffer which computes changes in real-time.

    **Note**: This does not actually buffer anything, and should only be used
              in development and testing environments.
    """

    def incr(
        self,
        model: type[models.Model],
        columns: dict[str, int],
        filters: dict[str, Any],
        extra: dict[str, Any] | None = None,
        signal_only: bool | None = None,
    ) -> None:
        self.process(model, columns, filters, extra, signal_only)
