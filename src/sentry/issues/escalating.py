import datetime

from snuba_sdk import Column, Condition, Entity, Function, Limit, Offset, Op, Query, Request

from sentry.utils.snuba import raw_snql_query


def query_groups_past_counts():
    query = Query(
        match=Entity("events"),
        select=[
            Column("project_id"),
            Column("group_id"),
            Function("toStartOfHour", [Column("timestamp")], "hourBucket"),
        ],
        groupby=[Column("project_id"), Column("group_id"), Column("hourBucket")],
        where=[
            Condition(Column("group_id"), Op.IN, Function("tuple", [32, 14])),
            Condition(Column("project_id"), Op.IN, Function("tuple", [1, 2, 3, 4, 5])),
            Condition(Column("timestamp"), Op.GTE, datetime.datetime(2023, 3, 14)),
            Condition(Column("timestamp"), Op.LT, datetime.datetime(2023, 3, 29)),
        ],
        limit=Limit(1),  # Limit(10000),
        offset=Offset(0),
        # TODO: ORDER BY project_id DESC, group_id DESC, hourBucket DESC
        # orderby=[OrderBy(Column("project_id"), Direction.DESC)]
    )
    request = Request(dataset="events", app_id="sentry.issues.escalating", query=query)
    request.validate()
    return raw_snql_query(request, referrer="sentry.issues.escalating")


# This is useful in order to call this module as a script
# sentry exec src/sentry/issues/escalating.py
if __name__ == "__main__":
    import pprint

    pprint.pprint(query_groups_past_counts())
