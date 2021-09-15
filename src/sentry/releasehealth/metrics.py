from datetime import datetime
from typing import Any, Mapping, Optional, Sequence

from sentry.releasehealth.base import ReleaseHealthBackend


class MetricsReleaseHealthBackend(ReleaseHealthBackend):
    """Gets release health results from the metrics datasets"""

    def query(
        self,
        selected_columns: Sequence[str],
        filter_keys: Mapping[str, Any],
        conditions: Sequence[Any],  # TODO: better typing
        start: datetime,
        end: datetime,
        rollup: int,
        groupby: Sequence[str],
        referrer: Optional[str],
    ) -> Sequence[Mapping[str, Any]]:
        data = []
        # TODO: use snql
        # FIXME: respect selected_columns
        # TODO: reduce number of snuba queries (one per entity should be enough),
        #       similar to SnubaQueryBuilder
        return data
