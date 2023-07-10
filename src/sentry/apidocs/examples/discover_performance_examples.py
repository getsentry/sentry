from drf_spectacular.utils import OpenApiExample


class DiscoverAndPerformanceExamples:
    QUERY_DISCOVER_EVENTS = [
        OpenApiExample(
            "Success",
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
