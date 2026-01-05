from drf_spectacular.utils import OpenApiExample


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
            value={
                "timeSeries": [
                    {
                        "values": [
                            {"timestamp": 1741368281123, "value": 5},
                            {"timestamp": 1741368281123, "value": 5},
                        ],
                        "axis": "count()",
                        "groupBy": [
                            {"transaction": "foo"},
                            {"project": "bar"},
                            {"tag[foo]": "baz"},
                        ],
                        "meta": {
                            "valueType": "integer",
                            "interval": 3600,
                        },
                    },
                    {
                        "values": [
                            {"timestamp": 1741368281123, "value": 5},
                            {"timestamp": 1741368281123, "value": 5},
                        ],
                        "axis": "count()",
                        "groupBy": [
                            {"transaction": "foo"},
                            {"project": "ball"},
                            {"tag[foo]": "baz"},
                        ],
                        "meta": {
                            "valueType": "integer",
                            "interval": 3600,
                        },
                    },
                ],
                "meta": {"dataset": "spans", "start": 1741368281123, "end": 1741368281123},
            },
            status_codes=["200"],
            response_only=True,
        ),
    ]
