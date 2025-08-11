from drf_spectacular.utils import OpenApiExample

SIMPLE_TAG_DETAILS = {
    "key": "flavors",
    "name": "Flavors",
    "uniqueValues": 2,
    "totalValues": 3,
    "topValues": [
        {
            "key": "strawberry",
            "name": "Strawberry",
            "value": "strawberry",
            "count": 2,
            "lastSeen": "2024-01-01T00:00:00Z",
            "firstSeen": "2024-01-01T00:00:00Z",
        },
        {
            "key": "vanilla",
            "name": "Vanilla",
            "value": "vanilla",
            "count": 1,
            "lastSeen": "2024-01-01T00:00:00Z",
            "firstSeen": "2024-01-01T00:00:00Z",
        },
    ],
}

SIMPLE_TAG_VALUES = [
    {
        "key": "strawberry",
        "name": "Strawberry",
        "value": "strawberry",
        "count": 2,
        "lastSeen": "2024-01-01T00:00:00Z",
        "firstSeen": "2024-01-01T00:00:00Z",
    },
    {
        "key": "vanilla",
        "name": "Vanilla",
        "value": "vanilla",
        "count": 1,
        "lastSeen": "2024-01-01T00:00:00Z",
        "firstSeen": "2024-01-01T00:00:00Z",
    },
    {
        "key": "chocolate",
        "name": "Chocolate",
        "value": "chocolate",
        "count": 1,
        "lastSeen": "2024-01-01T00:00:00Z",
        "firstSeen": "2024-01-01T00:00:00Z",
    },
    {
        "key": "Neopolitan",
        "name": "Neopolitan",
        "value": "neopolitan",
        "count": 1,
        "lastSeen": "2024-01-01T00:00:00Z",
        "firstSeen": "2024-01-01T00:00:00Z",
    },
]


class TagsExamples:
    GROUP_TAGKEY_DETAILS = OpenApiExample(
        "Return a specific tag's details",
        value=SIMPLE_TAG_DETAILS,
        response_only=True,
        status_codes=["200"],
    )

    GROUP_TAGKEY_VALUES = OpenApiExample(
        "Return all tag values for a specific tag",
        value=SIMPLE_TAG_VALUES,
        response_only=True,
        status_codes=["200"],
    )
