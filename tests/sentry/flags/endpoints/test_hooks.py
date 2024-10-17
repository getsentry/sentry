from urllib.parse import quote

import pytest
from django.urls import reverse
from rest_framework.exceptions import AuthenticationFailed

from sentry.flags.endpoints.hooks import get_org_id_from_token
from sentry.flags.models import ACTION_MAP, CREATED_BY_TYPE_MAP, FlagAuditLogModel
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.security.orgauthtoken_token import hash_token


class OrganizationFlagsHooksEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-flag-hooks"

    def setUp(self):
        super().setUp()

    def test_bad_token(self):
        token_str = "badtoken"
        url = reverse(self.endpoint, args=("launchdarkly", token_str))

        response = self.client.post(url, {})

        assert response.status_code == 403

    def test_bad_org(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token_str = "sntrys+_abc123_xyz"
            token_encoded = quote(token_str)
            OrgAuthToken.objects.create(
                name="Test Token 1",
                token_hashed=hash_token(token_str),
                organization_id=1234,
                token_last_characters="xyz",
                scope_list=["org:ci"],
                date_last_used=None,
            )
        with pytest.raises(AuthenticationFailed):
            get_org_id_from_token(token_encoded)

    def test_no_provider(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token_str = "sntrys+_abc123_xyz"
            token_encoded = quote(token_str)
            OrgAuthToken.objects.create(
                name="Test Token 1",
                token_hashed=hash_token(token_str),
                organization_id=self.organization.id,
                token_last_characters="xyz",
                scope_list=["org:ci"],
                date_last_used=None,
            )

        url = reverse(self.endpoint, args=("test", token_encoded))
        response = self.client.post(url, {})
        assert response.status_code == 404

    def test_launchdarkly_post_create(self):
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
                {"action": "createFlag", "resource": "proj/default:env/production:flag/test-flag"},
            ],
            "kind": "flag",
            "name": "test flag",
            "description": "",
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

        with assume_test_silo_mode(SiloMode.CONTROL):
            token_str = "sntrys+_abc123_xyz"
            token_encoded = quote(token_str)
            OrgAuthToken.objects.create(
                name="Test Token 1",
                token_hashed=hash_token(token_str),
                organization_id=self.organization.id,
                token_last_characters="xyz",
                scope_list=["org:ci"],
                date_last_used=None,
            )

        url = reverse(self.endpoint, args=("launchdarkly", token_encoded))

        response = self.client.post(url, request_data)

        assert response.status_code == 200
        assert FlagAuditLogModel.objects.count() == 1
        flag = FlagAuditLogModel.objects.first()
        assert flag is not None
        assert flag.action == ACTION_MAP["created"]
        assert flag.flag == "test flag"
        assert flag.created_by == "michelle@example.com"
        assert flag.created_by_type == CREATED_BY_TYPE_MAP["email"]
        assert flag.organization_id == self.organization.id
        assert flag.tags is not None

    def test_launchdarkly_post_update(self):
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
                "site": {"href": "/default/test/features/test-flag", "type": "text/html"},
            },
            "_id": "1234",
            "_accountId": "1234",
            "date": 1729123867537,
            "accesses": [
                {"action": "updateOn", "resource": "proj/default:env/test:flag/test-flag"},
                {"action": "updateFallthrough", "resource": "proj/default:env/test:flag/test-flag"},
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
            "parent": {
                "_links": {
                    "canonical": {
                        "href": "/api/v2/projects/default/environments/test",
                        "type": "application/json",
                    },
                    "site": {"href": "/settings/projects", "type": "text/html"},
                },
                "name": "Test",
                "resource": "proj/default:env/test",
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
                    "test": {
                        "on": False,
                        "archived": False,
                        "salt": "7495d3dcf72f43aaa075012fad947d0d",
                        "sel": "61b4861e6ed54135bc244bb120e9e2da",
                        "lastModified": 1729123867478,
                        "version": 2,
                        "targets": [],
                        "contextTargets": [],
                        "rules": [],
                        "fallthrough": {"variation": 1},
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

        with assume_test_silo_mode(SiloMode.CONTROL):
            token_str = "sntrys_+abc123_xyz"
            token_encoded = quote(token_str)
            OrgAuthToken.objects.create(
                name="Test Token 1",
                token_hashed=hash_token(token_str),
                organization_id=self.organization.id,
                token_last_characters="xyz",
                scope_list=["org:ci"],
                date_last_used=None,
            )

        url = reverse(self.endpoint, args=("launchdarkly", token_encoded))

        response = self.client.post(url, request_data)

        assert response.status_code == 200
        assert FlagAuditLogModel.objects.count() == 1
        flag = FlagAuditLogModel.objects.first()
        assert flag is not None
        assert flag.action == ACTION_MAP["updated"]
        assert flag.flag == "test flag"
        assert flag.created_by == "michelle@example.io"
        assert flag.created_by_type == CREATED_BY_TYPE_MAP["email"]
        assert flag.organization_id == self.organization.id
        assert flag.tags is not None
