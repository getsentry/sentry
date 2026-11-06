from drf_spectacular.utils import OpenApiExample

from sentry.api.endpoints.timeseries import StatsResponse


class DiscoverAndPerformanceExamples:
    QUERY_DISCOVER_EVENTS = [
        OpenApiExample(
            "Query Events",
            value={
                "data": [
                    {
                        "count_if(transaction.duration,greater,300)": 5,
                        "count()": 10,
                        "equation|count_if(transaction.duration,greater,300) / count() * 100": 50,
                        "transaction": "foo",
                    },
                    {
                        "count_if(transaction.duration,greater,300)": 3,
                        "count()": 20,
                        "equation|count_if(transaction.duration,greater,300) / count() * 100": 15,
                        "transaction": "bar",
                    },
                    {
                        "count_if(transaction.duration,greater,300)": 8,
                        "count()": 40,
                        "equation|count_if(transaction.duration,greater,300) / count() * 100": 20,
                        "transaction": "baz",
                    },
                ],
                "meta": {
                    "fields": {
                        "count_if(transaction.duration,greater,300)": "integer",
                        "count()": "integer",
                        "equation|count_if(transaction.duration,greater,300) / count() * 100": "number",
                        "transaction": "string",
                    },
                },
            },
            status_codes=["200"],
            response_only=True,
        )
    ]

    QUERY_TIMESERIES = [
        OpenApiExample(
            "Query Top Events as a Timeseries",
            value=StatsResponse(
                {
                    "timeSeries": [
                        {
                            "values": [
                                {"timestamp": 1741366800000, "value": 5, "incomplete": False},
                                {
                                    "timestamp": 1741370400000,
                                    "value": 3,
                                    "incomplete": True,
                                    "incompleteReason": "INGESTION_PENDING",
                                },
                                {
                                    "timestamp": 1741374000000,
                                    "value": 4,
                                    "incomplete": True,
                                    "incompleteReason": "NOT_ELAPSED",
                                },
                            ],
                            "yAxis": "count()",
                            "groupBy": [
                                {"key": "transaction", "value": "foo"},
                                {"key": "project", "value": "bar"},
                                {"key": "tag[foo]", "value": "baz"},
                            ],
                            "meta": {
                                "valueUnit": None,
                                "valueType": "integer",
                                "interval": 3600000,
                            },
                        },
                        {
                            "values": [
                                {"timestamp": 1741366800000, "value": 5, "incomplete": False},
                                {
                                    "timestamp": 1741370400000,
                                    "value": 2,
                                    "incomplete": True,
                                    "incompleteReason": "INGESTION_PENDING",
                                },
                                {
                                    "timestamp": 1741374000000,
                                    "value": 1,
                                    "incomplete": True,
                                    "incompleteReason": "NOT_ELAPSED",
                                },
                            ],
                            "yAxis": "count()",
                            "groupBy": [
                                {"key": "transaction", "value": "foo"},
                                {"key": "project", "value": "ball"},
                                {"key": "tag[foo]", "value": "baz"},
                            ],
                            "meta": {
                                "valueUnit": None,
                                "valueType": "integer",
                                "interval": 3600000,
                            },
                        },
                    ],
                    "meta": {
                        "dataset": "spans",
                        "start": 1741366800000,
                        "end": 1741374060000,
                        "ingestion": {
                            "status": "healthy",
                            "delaySeconds": 130.5,
                            "completeThrough": 1741373929500,
                        },
                    },
                }
            ),
            status_codes=["200"],
            response_only=True,
        ),
        OpenApiExample(
            "Filled and smoothed time series",
            description="""A leading gap remains null. An observed zero and a zero carried
forward by `fill(locf)` have different `filled` flags. `smooth(sma,2)` runs after filling.""",
            value=StatsResponse(
                timeSeries=[
                    {
                        "yAxis": "avg(span.duration)",
                        "values": [
                            {
                                "timestamp": 1741366800000,
                                "value": None,
                                "incomplete": False,
                                "filled": False,
                                "smoothed": False,
                            },
                            {
                                "timestamp": 1741366860000,
                                "value": 0,
                                "incomplete": False,
                                "filled": False,
                                "smoothed": True,
                            },
                            {
                                "timestamp": 1741366920000,
                                "value": 0,
                                "incomplete": False,
                                "filled": True,
                                "smoothed": True,
                            },
                        ],
                        "meta": {
                            "valueUnit": "millisecond",
                            "valueType": "duration",
                            "interval": 60000,
                        },
                    }
                ],
                meta={"dataset": "spans", "start": 1741366800000, "end": 1741366980000},
            ),
            status_codes=["200"],
            response_only=True,
        ),
    ]
