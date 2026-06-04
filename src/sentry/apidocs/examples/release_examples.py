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

ORGANIZATION_RELEASE_LIST_RESPONSE: list[ReleaseSerializerResponse] = [
    {
        "id": 2,
        "version": "2.0rc2",
        "shortVersion": "2.0rc2",
        "status": "open",
        "versionInfo": {
            "package": None,
            "version": {"raw": "2.0rc2"},
            "description": "2.0rc2",
            "buildHash": "2.0rc2",
        },
        "ref": "6ba09a7c53235ee8a8fa5ee4c1ca8ca886e7fdbb",
        "url": None,
        "dateReleased": None,
        "dateCreated": datetime.fromisoformat("2018-11-06T21:20:08.033Z"),
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
                "id": 2,
                "slug": "pump-station",
                "name": "Pump Station",
                "newGroups": 0,
                "platform": None,
                "platforms": [],
                "hasHealthData": False,
            }
        ],
        "firstEvent": None,
        "lastEvent": None,
        "currentProjectMeta": {},
        "userAgent": None,
    },
    {
        "id": 1,
        "version": "2b6af31b2edccc73a629108b17344dfe20858780",
        "shortVersion": "2b6af31",
        "status": "open",
        "versionInfo": {
            "package": None,
            "version": {"raw": "2b6af31b2edccc73a629108b17344dfe20858780"},
            "description": "2b6af31",
            "buildHash": "2b6af31b2edccc73a629108b17344dfe20858780",
        },
        "ref": None,
        "url": None,
        "dateReleased": None,
        "dateCreated": datetime.fromisoformat("2018-11-06T21:19:58.559Z"),
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
                "slug": "prime-mover",
                "name": "Prime Mover",
                "newGroups": 0,
                "platform": None,
                "platforms": [],
                "hasHealthData": False,
            }
        ],
        "firstEvent": datetime.fromisoformat("2018-11-06T21:19:58.639Z"),
        "lastEvent": datetime.fromisoformat("2018-11-06T21:19:58.639Z"),
        "currentProjectMeta": {},
        "userAgent": None,
    },
]

ORGANIZATION_RELEASE_CREATE_REQUEST = {
    "version": "2.0rc2",
    "ref": "6ba09a7c53235ee8a8fa5ee4c1ca8ca886e7fdbb",
    "projects": ["pump-station"],
}

ORGANIZATION_RELEASE_CREATE_RESPONSE: ReleaseSerializerResponse = {
    "id": 2,
    "version": "2.0rc2",
    "shortVersion": "2.0rc2",
    "status": "open",
    "versionInfo": {
        "package": None,
        "version": {"raw": "2.0rc2"},
        "description": "2.0rc2",
        "buildHash": "2.0rc2",
    },
    "ref": "6ba09a7c53235ee8a8fa5ee4c1ca8ca886e7fdbb",
    "url": None,
    "dateReleased": None,
    "dateCreated": datetime.fromisoformat("2019-01-03T00:12:55.109Z"),
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
            "id": 2,
            "slug": "pump-station",
            "name": "Pump Station",
            "newGroups": 0,
            "platform": None,
            "platforms": [],
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
            value=ORGANIZATION_RELEASE_LIST_RESPONSE,
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

    CREATE_ORGANIZATION_RELEASE = [
        OpenApiExample(
            "Create an organization release request",
            value=ORGANIZATION_RELEASE_CREATE_REQUEST,
            request_only=True,
        ),
        OpenApiExample(
            "Create an organization release response",
            value=ORGANIZATION_RELEASE_CREATE_RESPONSE,
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
