from drf_spectacular.utils import OpenApiExample


class SessionExamples:
    QUERY_SESSIONS = [
        OpenApiExample(
            "Query Sessions",
            value={
                "groups": [
                    {
                        "by": {"session.status": "errored"},
                        "totals": {"sum(session)": 1000},
                        "series": {"sum(session)": [368, 392, 240]},
                    },
                    {
                        "by": {"session.status": "healthy"},
                        "totals": {"sum(session)": 17905998},
                        "series": {"sum(session)": [6230841, 6923689, 4751465]},
                    },
                ],
                "start": "2024-01-29T07:30:00Z",
                "end": "2024-01-29T09:00:00Z",
                "intervals": [
                    "2024-01-29T07:30:00Z",
                    "2024-01-29T08:00:00Z",
                    "2024-01-29T08:30:00Z",
                ],
                "query": "",
            },
            status_codes=["200"],
            response_only=True,
        )
    ]
