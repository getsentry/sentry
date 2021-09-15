from datetime import datetime
from typing import Any, Mapping, Optional, Sequence

from sentry.releasehealth.base import ReleaseHealthBackend
from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import raw_query


class SessionsReleaseHealthBackend(ReleaseHealthBackend):

    """Gets release health results from the session dataset"""

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
        return raw_query(
            dataset=Dataset.Sessions,
            selected_columns=selected_columns,
            filter_keys=filter_keys,
            start=start,
            end=end,
            rollup=rollup,
            groupby=groupby,
            referrer=referrer,
        )["data"]
