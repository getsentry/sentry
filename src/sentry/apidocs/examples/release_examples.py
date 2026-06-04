from datetime import datetime

from drf_spectacular.utils import OpenApiExample

from sentry.api.serializers.models.commit import CommitSerializerResponse
from sentry.api.serializers.models.release_file import ReleaseFileSerializerResponse
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

RELEASE_FILE: ReleaseFileSerializerResponse = {
    "id": "3",
    "name": "/demo/goodbye.txt",
    "dist": None,
    "headers": {"Content-Type": "text/plain; encoding=utf-8"},
    "size": 15,
    "sha1": "94d6b21e962a9fc65889617ec1f17a1e2fe11b65",
    "dateCreated": datetime.fromisoformat("2018-11-06T21:20:22.894Z"),
}

RELEASE_FILE_UPLOAD = {
    "name": "/demo/hello.min.js.map",
    "file": "@hello.min.js.map",
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

    LIST_RELEASE_FILES = [
        OpenApiExample(
            "Return a list of files for a release",
            value=[RELEASE_FILE],
            response_only=True,
            status_codes=["200"],
        )
    ]

    UPLOAD_RELEASE_FILE = [
        OpenApiExample(
            "Upload a release file",
            value=RELEASE_FILE_UPLOAD,
            request_only=True,
            media_type="multipart/form-data",
        ),
        OpenApiExample(
            "Return an uploaded release file",
            value=RELEASE_FILE,
            response_only=True,
            status_codes=["201"],
        ),
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
