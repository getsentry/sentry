from drf_spectacular.utils import OpenApiExample

replay_example = {
    "activity": 5,
    "browser": {"name": "Chome", "version": "103.0.38"},
    "count_dead_clicks": 6,
    "count_rage_clicks": 1,
    "count_errors": 1,
    "count_segments": 0,
    "count_urls": 1,
    "device": {
        "brand": "Apple",
        "family": "iPhone",
        "model": "11",
        "name": "iPhone 11",
    },
    "dist": None,
    "duration": 576,
    "environment": "production",
    "error_ids": ["7e07485f-12f9-416b-8b14-26260799b51f"],
    "finished_at": "2022-07-07T14:15:33.201019",
    "id": "7e07485f-12f9-416b-8b14-26260799b51f",
    "is_archived": None,
    "os": {"name": "iOS", "version": "16.2"},
    "platform": "Sentry",
    "project_id": "639195",
    "releases": ["version@1.4"],
    "sdk": {"name": "Thundercat", "version": "27.1"},
    "started_at": "2022-07-07T14:05:57.909921",
    "tags": {"hello": ["world", "Lionel Richie"]},
    "trace_ids": ["7e07485f-12f9-416b-8b14-26260799b51f"],
    "urls": ["/organizations/abc123/issues"],
    "user": {
        "display_name": "John Doe",
        "email": "john.doe@example.com",
        "id": "30246326",
        "ip": "213.164.1.114",
        "username": "John Doe",
    },
}


class ReplayExamples:
    GET_REPLAYS = [
        OpenApiExample(
            "Get list of replays",
            value=[replay_example],
            status_codes=["200"],
            response_only=True,
        )
    ]

    GET_REPLAY_DETAILS = [
        OpenApiExample(
            "Get single replay details",
            value=replay_example,
            status_codes=["200"],
            response_only=True,
        ),
    ]

    GET_SELECTORS = [
        OpenApiExample(
            "Retrieve a collection of selectors for an organization.",
            value={
                "data": [
                    {
                        "count_dead_clicks": 2,
                        "count_rage_clicks": 1,
                        "dom_element": "div#myid.class1.class2",
                        "element": {
                            "alt": "",
                            "aria_label": "",
                            "class": ["class1", "class2"],
                            "id": "myid",
                            "role": "",
                            "tag": "div",
                            "testid": "",
                            "title": "",
                        },
                        "project_id": "1",
                    }
                ]
            },
        )
    ]

    GET_REPLAY_COUNTS = [
        OpenApiExample(
            "Query replay count by issue or transaction id",
            value={
                1: 9,
                2: 0,
                5: 0,
                9: 1,
                10: 29,
            },
            status_codes=["200"],
            response_only=True,
        )
    ]
