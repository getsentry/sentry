from datetime import datetime

from drf_spectacular.utils import OpenApiExample

from sentry.api.serializers.types import ReleaseSerializerResponse

RELEASE: ReleaseSerializerResponse = {
    "id": 1,
    "version": "frontend@1.0.0",
    "shortVersion": "frontend@1.0.0",
    "status": "open",
    "versionInfo": {
        "package": "frontend",
        "version": {
            "raw": "1.0.0",
            "major": 1,
            "minor": 0,
            "patch": 0,
            "pre": None,
            "buildCode": None,
            "components": 3,
        },
        "description": "1.0.0",
        "buildHash": None,
    },
    "ref": None,
    "url": None,
    "dateReleased": None,
    "dateCreated": datetime.fromisoformat("2024-01-01T00:00:00Z"),
    "data": {},
    "newGroups": 0,
    "owner": None,
    "commitCount": 0,
    "lastCommit": None,
    "deployCount": 0,
    "lastDeploy": None,
    "authors": [],
    "projects": [
        {
            "id": 1,
            "slug": "sentry",
            "name": "sentry",
            "newGroups": 0,
            "platform": "javascript",
            "platforms": ["javascript"],
            "hasHealthData": False,
        }
    ],
    "firstEvent": None,
    "lastEvent": None,
    "currentProjectMeta": {},
    "userAgent": None,
}


class ReleaseExamples:
    LIST_PROJECT_RELEASES = [
        OpenApiExample(
            "Return a list of releases for a project",
            value=[RELEASE],
            response_only=True,
            status_codes=["200"],
        )
    ]
