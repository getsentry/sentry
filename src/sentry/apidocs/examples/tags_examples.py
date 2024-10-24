from drf_spectacular.utils import OpenApiExample

SIMPLE_TAG_DETAILS = {
    "key": "flavors",
    "name": "Flavors",
    "uniqueValues": 2,
    "totalValues": 3,
    "topValues": [
        {
            "key": "chunkymonkey",
            "name": "Chunky Monkey",
            "value": "chunkymonkey",
            "count": 2,
            "lastSeen": "2024-01-01T00:00:00Z",
            "firstSeen": "2024-01-01T00:00:00Z",
        },
        {
            "key": "halfbaked",
            "name": "Half Baked",
            "value": "halfbaked",
            "count": 1,
            "lastSeen": "2024-01-01T00:00:00Z",
            "firstSeen": "2024-01-01T00:00:00Z",
        },
    ],
}


class TagsExamples:
    GROUP_TAGKEY_DETAILS = OpenApiExample(
        "Return a specific tag's details",
        value=SIMPLE_TAG_DETAILS,
        response_only=True,
        status_codes=["200"],
    )
