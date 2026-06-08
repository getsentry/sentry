from datetime import datetime

from drf_spectacular.utils import OpenApiExample

from sentry.api.serializers.models.commit import (
    CommitReleaseSerializerResponse,
    CommitSerializerResponseWithReleases,
)
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


COMMIT_RELEASE: CommitReleaseSerializerResponse = {
    "version": "frontend@1.0.0",
    "shortVersion": "frontend@1.0.0",
    "ref": None,
    "url": None,
    "dateReleased": None,
    "dateCreated": datetime.fromisoformat("2018-11-06T21:19:58.536Z"),
}

COMMIT: CommitSerializerResponseWithReleases = {
    "id": "acbafc639127fd89d10f474520104517ff1d709e",
    "message": "Initial commit from Create Next App",
    "dateCreated": datetime.fromisoformat("2018-11-06T21:19:58.536Z"),
    "pullRequest": None,
    "suspectCommitType": "",
    "releases": [COMMIT_RELEASE],
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
