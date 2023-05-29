from typing import Dict, List, Optional

from snuba_sdk import Column, Condition, Op

from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import ParamsType
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query


def get_profiles_id(
    params: ParamsType,
    query: Optional[str] = None,
) -> Dict[str, List[str]]:
    builder = QueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        query=query,
        selected_columns=["profile.id"],
        limit=100,
    )

    builder.add_conditions(
        [
            Condition(Column("type"), Op.EQ, "transaction"),
            Condition(Column("profile_id"), Op.IS_NOT_NULL),
        ]
    )

    snql_query = builder.get_snql_query()
    data = raw_snql_query(
        snql_query,
        referrer=Referrer.API_PROFILING_PROFILE_FLAMEGRAPH.value,
    )["data"]
    return {"profile_ids": [row["profile.id"] for row in data]}
