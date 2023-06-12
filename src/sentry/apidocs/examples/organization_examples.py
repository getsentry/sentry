from drf_spectacular.utils import OpenApiExample


class OrganizationExamples:
    LIST_PROJECTS = [
        OpenApiExample(
            "Success",
            value=[
                {
                    "dateCreated": "2018-11-06T21:19:58.536Z",
                    "firstEvent": None,
                    "access": [],
                    "hasAccess": True,
                    "id": "3",
                    "isBookmarked": False,
                    "isMember": True,
                    "name": "Prime Mover",
                    "platform": "",
                    "platforms": [],
                    "slug": "prime-mover",
                    "team": {
                        "id": "2",
                        "name": "Powerful Abolitionist",
                        "slug": "powerful-abolitionist",
                    },
                    "teams": [
                        {
                            "id": "2",
                            "name": "Powerful Abolitionist",
                            "slug": "powerful-abolitionist",
                        }
                    ],
                    "environments": ["local"],
                    "eventProcessing": {"symbolicationDegraded": False},
                    "features": ["releases"],
                    "firstTransactionEvent": True,
                    "hasSessions": True,
                    "hasProfiles": True,
                    "hasReplays": True,
                    "hasMinifiedStackTrace": False,
                    "hasMonitors": True,
                    "hasUserReports": False,
                    "latestRelease": None,
                }
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]

    RETRIEVE_EVENT_COUNTS_V2 = [
        OpenApiExample(
            "Successful response",
            value={
                "start": "2022-02-14T19:00:00Z",
                "end": "2022-02-28T18:03:00Z",
                "intervals": ["2022-02-28T00:00:00Z"],
                "groups": [
                    {
                        "by": {"outcome": "invalid"},
                        "totals": {"sum(quantity)": 165665},
                        "series": {"sum(quantity)": [165665]},
                    }
                ],
            },
            status_codes=["200"],
            response_only=True,
        ),
    ]
