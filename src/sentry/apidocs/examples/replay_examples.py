from drf_spectacular.utils import OpenApiExample


class ReplayExamples:
    GET_REPLAYS = [
        OpenApiExample(
            "Success",
            value=[
                {
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
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]

    GET_REPLAY_DETAILS = [
        OpenApiExample(
            "Success",
            value=[
                {
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
            ],
            status_codes=["200"],
            response_only=True,
        ),
    ]
