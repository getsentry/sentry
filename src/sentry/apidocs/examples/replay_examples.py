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
    "has_viewed": True,
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

    GET_REPLAY_CLICKS = [
        OpenApiExample(
            "Retrieve a collection of RRWeb DOM node-ids and the timestamp they were clicked.",
            value={"data": [{"node_id": 1, "timestamp": "2024-02-08T15:52:25+00:00"}]},
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
                            "component_name": "",
                            "id": "myid",
                            "role": "",
                            "tag": "div",
                            "testid": "",
                            "title": "",
                        },
                        "project_id": "1",
                    },
                ],
            },
            status_codes=["200"],
            response_only=True,
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

    GET_REPLAY_SEGMENTS = [
        OpenApiExample(
            "Retrieve a collection of replay segments",
            value=[
                [
                    {
                        "type": 5,
                        "timestamp": 1658770772.902,
                        "data": {
                            "tag": "performanceSpan",
                            "payload": {
                                "op": "memory",
                                "description": "",
                                "startTimestamp": 1658770772.902,
                                "endTimestamp": 1658770772.902,
                                "data": {
                                    "memory": {
                                        "jsHeapSizeLimit": 4294705152,
                                        "totalJSHeapSize": 10204109,
                                        "usedJSHeapSize": 9131621,
                                    }
                                },
                            },
                        },
                    }
                ],
                [
                    {
                        "type": 5,
                        "timestamp": 1665063926.125,
                        "data": {
                            "tag": "performanceSpan",
                            "payload": {
                                "op": "navigation.navigate",
                                "description": "https://sentry.io",
                                "startTimestamp": 1665063926.125,
                                "endTimestamp": 1665063926.833,
                                "data": {"size": 9538, "duration": 710},
                            },
                        },
                    }
                ],
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]

    GET_REPLAY_SEGMENT = [
        OpenApiExample(
            "Retrieve a replay segment",
            value=[
                {
                    "type": 5,
                    "timestamp": 1658770772.902,
                    "data": {
                        "tag": "performanceSpan",
                        "payload": {
                            "op": "memory",
                            "description": "",
                            "startTimestamp": 1658770772.902,
                            "endTimestamp": 1658770772.902,
                            "data": {
                                "memory": {
                                    "jsHeapSizeLimit": 4294705152,
                                    "totalJSHeapSize": 10204109,
                                    "usedJSHeapSize": 9131621,
                                }
                            },
                        },
                    },
                }
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]

    GET_REPLAY_VIDEO = [
        OpenApiExample(
            "Retrieve a replay video",
            value=b"hello, world!",
            status_codes=[200],
            response_only=True,
        )
    ]

    GET_REPLAY_VIEWED_BY = [
        OpenApiExample(
            "Get list of users who have viewed a replay",
            value={
                "data": {
                    "viewed_by": [
                        {
                            "id": "884411",
                            "name": "some.body@sentry.io",
                            "username": "d93522a35cb64c13991104bd73d44519",
                            "email": "some.body@sentry.io",
                            "avatarUrl": "https://gravatar.com/avatar/d93522a35cb64c13991104bd73d44519d93522a35cb64c13991104bd73d44519?s=32&d=mm",
                            "isActive": True,
                            "hasPasswordAuth": False,
                            "isManaged": False,
                            "dateJoined": "2022-07-25T23:36:29.593212Z",
                            "lastLogin": "2024-03-14T18:11:28.740309Z",
                            "has2fa": True,
                            "lastActive": "2024-03-15T22:22:06.925934Z",
                            "isSuperuser": True,
                            "isStaff": False,
                            "experiments": {},
                            "emails": [
                                {
                                    "id": "2231333",
                                    "email": "some.body@sentry.io",
                                    "is_verified": True,
                                }
                            ],
                            "avatar": {
                                "avatarType": "upload",
                                "avatarUuid": "499dcd0764da42a589654a2224086e67",
                                "avatarUrl": "https://sentry.io/avatar/499dcd0764da42a589654a2224086e67/",
                            },
                            "type": "user",
                        }
                    ],
                }
            },
            status_codes=[200],
            response_only=True,
        )
    ]
