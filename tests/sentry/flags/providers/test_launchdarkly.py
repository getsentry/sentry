import pytest
from django.utils import timezone
from rest_framework.exceptions import ErrorDetail

from sentry.flags.models import ACTION_MAP, CREATED_BY_TYPE_MAP
from sentry.flags.providers import (
    DeserializationError,
    LaunchDarklyItemSerializer,
    LaunchDarklyProvider,
)

default_timezone = timezone.get_default_timezone()


def test_launchdarkly_create():
    request_data = {
        "_links": {
            "canonical": {
                "href": "/api/v2/flags/default/test-flag",
                "type": "application/json",
            },
            "parent": {"href": "/api/v2/auditlog", "type": "application/json"},
            "self": {
                "href": "/api/v2/auditlog/1234",
                "type": "application/json",
            },
            "site": {"href": "/default/~/features/test-flag", "type": "text/html"},
        },
        "_id": "1234",
        "_accountId": "1234",
        "date": 1729123465221,
        "accesses": [
            {"action": "createFlag", "resource": "proj/default:env/test:flag/test-flag"},
        ],
        "kind": "flag",
        "name": "test flag",
        "description": "flag was created",
        "shortDescription": "",
        "member": {
            "_links": {
                "parent": {"href": "/api/v2/members", "type": "application/json"},
                "self": {
                    "href": "/api/v2/members/1234",
                    "type": "application/json",
                },
            },
            "_id": "1234",
            "email": "michelle@example.com",
            "firstName": "Michelle",
            "lastName": "Doe",
        },
        "titleVerb": "created the flag",
        "title": "Michelle created the flag [test flag](https://app.launchdarkly.com/default/~/features/test-flag)",
        "target": {
            "_links": {
                "canonical": {
                    "href": "/api/v2/flags/default/test-flag",
                    "type": "application/json",
                },
                "site": {"href": "/default/~/features/test-flag", "type": "text/html"},
            },
            "name": "test flag",
            "resources": [
                "proj/default:env/test:flag/test-flag",
                "proj/default:env/production:flag/test-flag",
            ],
        },
        "currentVersion": {
            "name": "test flag",
            "kind": "boolean",
            "description": "testing a feature flag",
            "key": "test-flag",
            "_version": 1,
            "creationDate": 1729123465176,
            "includeInSnippet": False,
            "clientSideAvailability": {"usingMobileKey": False, "usingEnvironmentId": False},
            "variations": [
                {"_id": "d883033e-fa8b-41d4-a4be-112d9a59278e", "value": True, "name": "on"},
                {"_id": "73aaa33f-c9ca-4bdc-8c97-01a20567aa3f", "value": False, "name": "off"},
            ],
            "temporary": False,
            "tags": [],
            "_links": {
                "parent": {"href": "/api/v2/flags/default", "type": "application/json"},
                "self": {"href": "/api/v2/flags/default/test-flag", "type": "application/json"},
            },
            "maintainerId": "1234",
            "_maintainer": {
                "_links": {
                    "self": {
                        "href": "/api/v2/members/1234",
                        "type": "application/json",
                    }
                },
                "_id": "1234",
                "firstName": "Michelle",
                "lastName": "Doe",
                "role": "owner",
                "email": "michelle@example.com",
            },
            "goalIds": [],
            "experiments": {"baselineIdx": 0, "items": []},
            "customProperties": {},
            "archived": False,
            "deprecated": False,
            "defaults": {"onVariation": 0, "offVariation": 1},
            "environments": {
                "production": {
                    "on": False,
                    "archived": False,
                    "salt": "1234",
                    "sel": "1234",
                    "lastModified": 1729123465190,
                    "version": 1,
                    "targets": [],
                    "contextTargets": [],
                    "rules": [],
                    "fallthrough": {"variation": 0},
                    "offVariation": 1,
                    "prerequisites": [],
                    "_site": {
                        "href": "/default/production/features/test-flag",
                        "type": "text/html",
                    },
                    "_environmentName": "Production",
                    "trackEvents": False,
                    "trackEventsFallthrough": False,
                },
                "test": {
                    "on": False,
                    "archived": False,
                    "salt": "7495d3dcf72f43aaa075012fad947d0d",
                    "sel": "61b4861e6ed54135bc244bb120e9e2da",
                    "lastModified": 1729123465190,
                    "version": 1,
                    "targets": [],
                    "contextTargets": [],
                    "rules": [],
                    "fallthrough": {"variation": 0},
                    "offVariation": 1,
                    "prerequisites": [],
                    "_site": {"href": "/default/test/features/test-flag", "type": "text/html"},
                    "_environmentName": "Test",
                    "trackEvents": False,
                    "trackEventsFallthrough": False,
                },
            },
        },
    }
    res = LaunchDarklyProvider(123, None).handle(request_data)
    assert len(res) == 1
    flag_row = res[0]
    assert flag_row["action"] == ACTION_MAP["created"]
    assert flag_row["flag"] == "test flag"
    assert flag_row["created_by"] == "michelle@example.com"
    assert flag_row["created_by_type"] == CREATED_BY_TYPE_MAP["email"]
    assert flag_row["organization_id"] == 123
    assert flag_row["tags"] is not None
    assert flag_row["tags"]["description"] == "flag was created"


def test_launchdarkly_update():
    request_data = {
        "_id": "1234",
        "_accountId": "1234",
        "date": 1729123867537,
        "accesses": [
            {"action": "updateOn", "resource": "proj/default:env/test:flag/test-flag"},
            {"action": "randomActionReject", "resource": "proj/default:env/test:flag/test-flag"},
        ],
        "kind": "flag",
        "name": "test flag",
        "description": "* Turned the flag on\n* Changed the default variation from ~~`on`~~ to `off`\n",
        "shortDescription": "",
        "comment": "",
        "member": {
            "_links": {
                "parent": {"href": "/api/v2/members", "type": "application/json"},
                "self": {
                    "href": "/api/v2/members/1234",
                    "type": "application/json",
                },
            },
            "_id": "1234",
            "email": "michelle@example.io",
            "firstName": "Michelle",
            "lastName": "Doe",
        },
        "titleVerb": "updated the flag",
        "title": "Michelle updated the flag [test flag](https://app.launchdarkly.com/default/test/features/test-flag) in `Test`",
        "target": {
            "_links": {
                "canonical": {
                    "href": "/api/v2/flags/default/test-flag",
                    "type": "application/json",
                },
                "site": {"href": "/default/test/features/test-flag", "type": "text/html"},
            },
            "name": "test flag",
            "resources": ["proj/default:env/test:flag/test-flag"],
        },
        "previousVersion": {
            "name": "test flag",
            "kind": "boolean",
            "description": "testing a feature flag",
            "key": "test-flag",
            "_version": 1,
            "creationDate": 1729123465176,
            "includeInSnippet": False,
            "clientSideAvailability": {"usingMobileKey": False, "usingEnvironmentId": False},
            "variations": [
                {"_id": "1234", "value": True, "name": "on"},
                {"_id": "1234", "value": False, "name": "off"},
            ],
            "temporary": True,
            "tags": [],
            "_links": {
                "parent": {"href": "/api/v2/flags/default", "type": "application/json"},
                "self": {"href": "/api/v2/flags/default/test-flag", "type": "application/json"},
            },
            "maintainerId": "1234",
            "_maintainer": {
                "_links": {
                    "self": {
                        "href": "/api/v2/members/1234",
                        "type": "application/json",
                    }
                },
                "_id": "1234",
                "firstName": "Michelle",
                "lastName": "Doe",
                "role": "owner",
                "email": "michelle@example.io",
            },
            "goalIds": [],
            "experiments": {"baselineIdx": 0, "items": []},
            "customProperties": {},
            "archived": False,
            "deprecated": False,
            "defaults": {"onVariation": 0, "offVariation": 1},
            "environments": {
                "production": {
                    "on": False,
                    "archived": False,
                    "salt": "ee006f821c8443538c49541256188073",
                    "sel": "d928ffd4789949d3b8956a35e3ded70f",
                    "lastModified": 1729123465190,
                    "version": 1,
                    "targets": [],
                    "contextTargets": [],
                    "rules": [],
                    "fallthrough": {"variation": 0},
                    "offVariation": 1,
                    "prerequisites": [],
                    "_site": {
                        "href": "/default/production/features/test-flag",
                        "type": "text/html",
                    },
                    "_environmentName": "Production",
                    "trackEvents": False,
                    "trackEventsFallthrough": False,
                },
                "test": {
                    "on": False,
                    "archived": False,
                    "salt": "7495d3dcf72f43aaa075012fad947d0d",
                    "sel": "61b4861e6ed54135bc244bb120e9e2da",
                    "lastModified": 1729123465190,
                    "version": 1,
                    "targets": [],
                    "contextTargets": [],
                    "rules": [],
                    "fallthrough": {"variation": 0},
                    "offVariation": 1,
                    "prerequisites": [],
                    "_site": {"href": "/default/test/features/test-flag", "type": "text/html"},
                    "_environmentName": "Test",
                    "trackEvents": False,
                    "trackEventsFallthrough": False,
                },
            },
        },
        "currentVersion": {
            "name": "test flag",
            "kind": "boolean",
            "description": "testing a feature flag",
            "key": "test-flag",
            "_version": 1,
            "creationDate": 1729123465176,
            "includeInSnippet": False,
            "clientSideAvailability": {"usingMobileKey": False, "usingEnvironmentId": False},
            "variations": [
                {"_id": "1234", "value": True, "name": "on"},
                {"_id": "1234", "value": False, "name": "off"},
            ],
            "temporary": True,
            "tags": [],
            "_links": {
                "parent": {"href": "/api/v2/flags/default", "type": "application/json"},
                "self": {"href": "/api/v2/flags/default/test-flag", "type": "application/json"},
            },
            "maintainerId": "1234",
            "_maintainer": {
                "_links": {
                    "self": {
                        "href": "/api/v2/members/1234",
                        "type": "application/json",
                    }
                },
                "_id": "1234",
                "firstName": "Michelle",
                "lastName": "Doe",
                "role": "owner",
                "email": "michelle@example.io",
            },
            "goalIds": [],
            "experiments": {"baselineIdx": 0, "items": []},
            "customProperties": {},
            "archived": False,
            "deprecated": False,
            "defaults": {"onVariation": 0, "offVariation": 1},
            "environments": {
                "production": {
                    "on": False,
                    "archived": False,
                    "salt": "ee006f821c8443538c49541256188073",
                    "sel": "d928ffd4789949d3b8956a35e3ded70f",
                    "lastModified": 1729123465190,
                    "version": 1,
                    "targets": [],
                    "contextTargets": [],
                    "rules": [],
                    "fallthrough": {"variation": 0},
                    "offVariation": 1,
                    "prerequisites": [],
                    "_site": {
                        "href": "/default/production/features/test-flag",
                        "type": "text/html",
                    },
                    "_environmentName": "Production",
                    "trackEvents": False,
                    "trackEventsFallthrough": False,
                },
            },
        },
    }

    res = LaunchDarklyProvider(123, None).handle(request_data)
    assert len(res) == 1
    flag_row = res[0]
    assert flag_row["action"] == ACTION_MAP["updated"]


def test_launchdarkly_create_no_member():
    request_data = {
        "_links": {
            "canonical": {
                "href": "/api/v2/flags/default/test-flag",
                "type": "application/json",
            },
            "parent": {"href": "/api/v2/auditlog", "type": "application/json"},
            "self": {
                "href": "/api/v2/auditlog/1234",
                "type": "application/json",
            },
            "site": {"href": "/default/~/features/test-flag", "type": "text/html"},
        },
        "_id": "1234",
        "_accountId": "1234",
        "date": 1729123465221,
        "accesses": [
            {"action": "createFlag", "resource": "proj/default:env/test:flag/test-flag"},
        ],
        "kind": "flag",
        "name": "test flag",
        "description": "flag was created",
        "shortDescription": "",
        "titleVerb": "created the flag",
        "title": "Michelle created the flag [test flag](https://app.launchdarkly.com/default/~/features/test-flag)",
        "target": {
            "_links": {
                "canonical": {
                    "href": "/api/v2/flags/default/test-flag",
                    "type": "application/json",
                },
                "site": {"href": "/default/~/features/test-flag", "type": "text/html"},
            },
            "name": "test flag",
            "resources": [
                "proj/default:env/test:flag/test-flag",
                "proj/default:env/production:flag/test-flag",
            ],
        },
        "currentVersion": {
            "name": "test flag",
            "kind": "boolean",
            "description": "testing a feature flag",
            "key": "test-flag",
            "_version": 1,
            "creationDate": 1729123465176,
            "includeInSnippet": False,
            "clientSideAvailability": {"usingMobileKey": False, "usingEnvironmentId": False},
            "variations": [
                {"_id": "d883033e-fa8b-41d4-a4be-112d9a59278e", "value": True, "name": "on"},
                {"_id": "73aaa33f-c9ca-4bdc-8c97-01a20567aa3f", "value": False, "name": "off"},
            ],
            "temporary": False,
            "tags": [],
            "_links": {
                "parent": {"href": "/api/v2/flags/default", "type": "application/json"},
                "self": {"href": "/api/v2/flags/default/test-flag", "type": "application/json"},
            },
            "maintainerId": "1234",
            "_maintainer": {
                "_links": {
                    "self": {
                        "href": "/api/v2/members/1234",
                        "type": "application/json",
                    }
                },
                "_id": "1234",
                "firstName": "Michelle",
                "lastName": "Doe",
                "role": "owner",
                "email": "michelle@example.com",
            },
            "goalIds": [],
            "experiments": {"baselineIdx": 0, "items": []},
            "customProperties": {},
            "archived": False,
            "deprecated": False,
            "defaults": {"onVariation": 0, "offVariation": 1},
            "environments": {
                "production": {
                    "on": False,
                    "archived": False,
                    "salt": "1234",
                    "sel": "1234",
                    "lastModified": 1729123465190,
                    "version": 1,
                    "targets": [],
                    "contextTargets": [],
                    "rules": [],
                    "fallthrough": {"variation": 0},
                    "offVariation": 1,
                    "prerequisites": [],
                    "_site": {
                        "href": "/default/production/features/test-flag",
                        "type": "text/html",
                    },
                    "_environmentName": "Production",
                    "trackEvents": False,
                    "trackEventsFallthrough": False,
                },
                "test": {
                    "on": False,
                    "archived": False,
                    "salt": "7495d3dcf72f43aaa075012fad947d0d",
                    "sel": "61b4861e6ed54135bc244bb120e9e2da",
                    "lastModified": 1729123465190,
                    "version": 1,
                    "targets": [],
                    "contextTargets": [],
                    "rules": [],
                    "fallthrough": {"variation": 0},
                    "offVariation": 1,
                    "prerequisites": [],
                    "_site": {"href": "/default/test/features/test-flag", "type": "text/html"},
                    "_environmentName": "Test",
                    "trackEvents": False,
                    "trackEventsFallthrough": False,
                },
            },
        },
    }
    res = LaunchDarklyProvider(123, None).handle(request_data)
    assert len(res) == 1
    flag_row = res[0]
    assert flag_row["action"] == ACTION_MAP["created"]
    assert flag_row["flag"] == "test flag"
    assert flag_row["created_by"] == "unknown"
    assert flag_row["created_by_type"] == CREATED_BY_TYPE_MAP["email"]
    assert flag_row["organization_id"] == 123
    assert flag_row["tags"] is not None
    assert flag_row["tags"]["description"] == "flag was created"


def test_launchdarkly_delete_and_update():
    request_data = {
        "_id": "1234",
        "_accountId": "1234",
        "date": 1729123867537,
        "accesses": [{"action": "deleteFlag", "resource": "proj/default:env/test:flag/test-flag"}],
        "kind": "flag",
        "name": "test flag",
        "description": "deleted the flag",
        "shortDescription": "",
        "comment": "",
        "member": {
            "_links": {
                "parent": {"href": "/api/v2/members", "type": "application/json"},
                "self": {
                    "href": "/api/v2/members/1234",
                    "type": "application/json",
                },
            },
            "_id": "1234",
            "email": "michelle@example.io",
            "firstName": "Michelle",
            "lastName": "Doe",
        },
        "titleVerb": "deleted the flag",
        "title": "Michelle deleted the flag [test flag](https://app.launchdarkly.com/default/test/features/test-flag) in `Test`",
    }

    res = LaunchDarklyProvider(123, None).handle(request_data)
    assert len(res) == 1
    flag_row_delete = res[0]
    assert flag_row_delete["action"] == ACTION_MAP["deleted"]


def test_launchdarkly_no_valid_action():
    request_data = {
        "_id": "1234",
        "_accountId": "1234",
        "date": 1729123867537,
        "accesses": [
            {"action": "copyFlagConfigTo", "resource": "proj/default:env/test:flag/test-flag"},
            {
                "action": "updateFlagRuleDescription	",
                "resource": "proj/default:env/test:flag/test-flag",
            },
        ],
        "kind": "flag",
        "name": "test flag",
        "description": "deleted the flag",
        "shortDescription": "",
        "comment": "",
        "member": {
            "_links": {
                "parent": {"href": "/api/v2/members", "type": "application/json"},
                "self": {
                    "href": "/api/v2/members/1234",
                    "type": "application/json",
                },
            },
            "_id": "1234",
            "email": "michelle@example.io",
            "firstName": "Michelle",
            "lastName": "Doe",
        },
        "titleVerb": "deleted the flag",
        "title": "Michelle deleted the flag [test flag](https://app.launchdarkly.com/default/test/features/test-flag) in `Test`",
    }

    res = LaunchDarklyProvider(123, None).handle(request_data)
    assert len(res) == 0


def test_bad_launchdarkly_data():
    request_data = {
        "accesses": [],
        "description": {},
        "member": {
            "_links": {
                "parent": {"href": "/api/v2/members", "type": "application/json"},
                "self": {
                    "href": "/api/v2/members/1234",
                    "type": "application/json",
                },
            },
            "_id": "1234",
            "firstName": "Michelle",
            "lastName": "Doe",
        },
    }

    serializer = LaunchDarklyItemSerializer(
        data=request_data,
    )
    assert not serializer.is_valid()
    assert serializer.errors == {
        "date": [ErrorDetail(string="This field is required.", code="required")],
        "name": [ErrorDetail(string="This field is required.", code="required")],
        "description": [ErrorDetail(string="Not a valid string.", code="invalid")],
    }

    with pytest.raises(
        DeserializationError,
    ):
        LaunchDarklyProvider(123, None).handle(request_data)
