from datetime import datetime

from drf_spectacular.utils import OpenApiExample

from sentry.api.serializers.models.commit import CommitSerializerResponse
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


COMMIT: CommitSerializerResponse = {
    "id": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "message": "fix: handle empty release version",
    "dateCreated": datetime.fromisoformat("2024-01-01T00:00:00Z"),
    "pullRequest": None,
    "suspectCommitType": "",
}

RELEASE_TIMESERIES = {
    "version": "frontend@1.0.0",
    "date": datetime.fromisoformat("2024-01-01T00:00:00Z"),
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

    LIST_ORGANIZATION_RELEASES = [
        OpenApiExample(
            "Return a list of releases for an organization",
            value=[RELEASE],
            response_only=True,
            status_codes=["200"],
        )
    ]

    RETRIEVE_RELEASE = [
        OpenApiExample(
            "Retrieve a release",
            value=RELEASE,
            response_only=True,
            status_codes=["200"],
        )
    ]

    CREATE_RELEASE = [
        OpenApiExample(
            "Create a release",
            value=RELEASE,
            response_only=True,
            status_codes=["201"],
        )
    ]

    LIST_RELEASE_COMMITS = [
        OpenApiExample(
            "Return a list of commits for a release",
            value=[COMMIT],
            response_only=True,
            status_codes=["200"],
        )
    ]

    LIST_RELEASE_TIMESERIES = [
        OpenApiExample(
            "Return a list of release versions and dates",
            value=[RELEASE_TIMESERIES],
            response_only=True,
            status_codes=["200"],
        )
    ]
