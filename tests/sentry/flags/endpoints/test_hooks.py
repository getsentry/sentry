from django.urls import reverse

from sentry.flags.models import (
    ACTION_MAP,
    CREATED_BY_TYPE_MAP,
    FlagAuditLogModel,
    FlagWebHookSigningSecretModel,
)
from sentry.flags.providers import hmac_sha256_hex_digest
from sentry.testutils.cases import APITestCase
from sentry.utils import json


class OrganizationFlagsHooksEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-flag-hooks"

    def setUp(self):
        super().setUp()
        self.url = reverse(self.endpoint, args=(self.organization.slug, "launchdarkly"))

    @property
    def features(self):
        return {"organizations:feature-flag-audit-log": True}

    def test_launchdarkly_post_create(self):
        request_data = LD_REQUEST
        signature = hmac_sha256_hex_digest(key="456", message=json.dumps(request_data).encode())

        # Test multiple secrets exist for the provider, org pair.
        FlagWebHookSigningSecretModel.objects.create(
            organization=self.organization, provider="launchdarkly", secret="123"
        )
        FlagWebHookSigningSecretModel.objects.create(
            organization=self.organization, provider="launchdarkly", secret="456"
        )

        with self.feature(self.features):
            response = self.client.post(
                self.url, request_data, headers={"X-LD-Signature": signature}
            )

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
        assert flag.tags["description"] == "flag was created"

    def test_launchdarkly_post_create_invalid_signature(self):
        with self.feature(self.features):
            sig = hmac_sha256_hex_digest(key="123", message=b"456")
            response = self.client.post(self.url, LD_REQUEST, headers={"X-LD-Signature": sig})
            assert response.status_code == 401

    def test_post_launchdarkly_deserialization_failed(self):
        signature = hmac_sha256_hex_digest(key="123", message=json.dumps({}).encode())
        FlagWebHookSigningSecretModel.objects.create(
            organization=self.organization, provider="launchdarkly", secret="123"
        )

        with self.feature(self.features):
            response = self.client.post(self.url, {}, headers={"X-LD-Signature": signature})
            assert response.status_code == 200
            assert FlagAuditLogModel.objects.count() == 0

    def test_post_invalid_provider(self):
        url = reverse(self.endpoint, args=(self.organization.slug, "test"))
        with self.feature(self.features):
            response = self.client.post(url, {})
            assert response.status_code == 404

    def test_post_disabled(self):
        response = self.client.post(self.url, data={})
        assert response.status_code == 404
        assert response.content == b'"Not enabled."'


LD_REQUEST = {
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
