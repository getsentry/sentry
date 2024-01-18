mock_sessions_data = {
    "groups": [
        {
            "by": {
                "project": 1,
                "release": "version1",
                "session.status": "healthy",
                "environment": "production",
            },
            "totals": {"sum(session)": 10},
            "series": {
                "sum(session)": [
                    1,
                    1,
                    1,
                    1,
                    1,
                    1,
                    1,
                    1,
                    1,
                    1,
                ]
            },
        },
        {
            "by": {
                "project": 1,
                "release": "version1",
                "session.status": "crashed",
                "environment": "production",
            },
            "totals": {"sum(session)": 1},
            "series": {
                "sum(session)": [
                    1,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                ]
            },
        },
        {
            "by": {
                "project": 1,
                "release": "version2",
                "session.status": "healthy",
                "environment": "canary",
            },
            "totals": {"sum(session)": 10},
            "series": {
                "sum(session)": [
                    1,
                    1,
                    1,
                    1,
                    1,
                    1,
                    1,
                    1,
                    1,
                    1,
                ]
            },
        },
        {
            "by": {
                "project": 1,
                "release": "version2",
                "session.status": "crashed",
                "environment": "canary",
            },
            "totals": {"sum(session)": 5},
            "series": {
                "sum(session)": [
                    1,
                    1,
                    1,
                    1,
                    1,
                    0,
                    0,
                    0,
                    0,
                    0,
                ]
            },
        },
        {
            "by": {
                "project": 2,
                "release": "version1",
                "session.status": "healthy",
                "environment": "production",
            },
            "totals": {"sum(session)": 0},
            "series": {
                "sum(session)": [
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                ]
            },
        },
        {
            "by": {
                "project": 2,
                "release": "version2",
                "session.status": "healthy",
                "environment": "production",
            },
            "totals": {"sum(session)": 5},
            "series": {
                "sum(session)": [
                    0,
                    0,
                    0,
                    0,
                    0,
                    1,
                    1,
                    1,
                    1,
                    1,
                ]
            },
        },
    ],
    "start": "2024-01-08T22:00:00Z",
    "end": "2024-01-09T23:00:00Z",
    "intervals": [
        "2024-01-08T22:00:00Z",
        "2024-01-08T23:00:00Z",
        "2024-01-09T00:00:00Z",
        "2024-01-09T01:00:00Z",
        "2024-01-09T02:00:00Z",
        "2024-01-09T03:00:00Z",
        "2024-01-09T04:00:00Z",
        "2024-01-09T05:00:00Z",
        "2024-01-09T06:00:00Z",
        "2024-01-09T07:00:00Z",
    ],
    "query": "release:version1 OR release:version2",
}
