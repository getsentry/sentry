from datetime import datetime
from typing import Any, Dict, List, Mapping, Optional, Protocol, Sequence, TypeVar

from sentry.utils.services import Service


class ReleaseHealthBackend(Service):
    """Abstraction layer for all release health related queries"""

    __all__ = ("query",)

    def query(
        self,
        selected_columns: Sequence[str],
        filter_keys: Mapping[str, Any],
        start: datetime,
        end: datetime,
        rollup: int,
        groupby: Sequence[str],
        referrer: Optional[str],
    ) -> Sequence[Mapping[str, Any]]:
        raise NotImplementedError()
