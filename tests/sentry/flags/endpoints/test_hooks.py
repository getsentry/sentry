from unittest.mock import patch

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


@patch("sentry.utils.metrics.incr")
class OrganizationFlagsHooksEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-flag-hooks"

    def setUp(self):
        super().setUp()
        self.url = reverse(self.endpoint, args=(self.organization.slug, "launchdarkly"))

    @property
    def features(self):
        return {"organizations:feature-flag-audit-log": True}

    def test_generic_post_create(self, mock_incr):
        request_data = {
            "data": [
                {
                    "action": "created",
                    "change_id": 9734362632,
                    "created_at": "2024-12-12T00:00:00+00:00",
                    "created_by": {"id": "username", "type": "name"},
                    "flag": "hello",
                }
            ],
            "meta": {"version": 1},
        }
        signature = hmac_sha256_hex_digest(key="456", message=json.dumps(request_data).encode())
        FlagWebHookSigningSecretModel.objects.create(
            organization=self.organization, provider="generic", secret="456"
        )

        with self.feature(self.features):
            response = self.client.post(
                reverse(self.endpoint, args=(self.organization.slug, "generic")),
                request_data,
                headers={"X-Sentry-Signature": signature},
            )
            assert response.status_code == 200, response.content
            mock_incr.assert_any_call(
                "feature_flags.audit_log_event_posted", tags={"provider": "generic"}
            )
            assert FlagAuditLogModel.objects.count() == 1

    def test_unleash_post_create(self, mock_incr):
        request_data = {
            "id": 28,
            "tags": [{"type": "simple", "value": "testvalue"}],
            "type": "feature-environment-enabled",
            "project": "default",
            "createdAt": "2024-12-30T00:00:00.000Z",
            "createdBy": "admin",
            "environment": "development",
            "createdByUserId": 1,
            "featureName": "test-flag",
        }
        signature = "testing12345abcdaslkflsldkfkdlks"
        FlagWebHookSigningSecretModel.objects.create(
            organization=self.organization,
            provider="unleash",
            secret="testing12345abcdaslkflsldkfkdlks",
        )

        with self.feature(self.features):
            response = self.client.post(
                reverse(self.endpoint, args=(self.organization.slug, "unleash")),
                request_data,
                headers={"Authorization": signature},
            )
            assert response.status_code == 200, response.content
            mock_incr.assert_any_call(
                "feature_flags.audit_log_event_posted", tags={"provider": "unleash"}
            )
            assert FlagAuditLogModel.objects.count() == 1

    def test_launchdarkly_post_create(self, mock_incr):
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
        mock_incr.assert_any_call(
            "feature_flags.audit_log_event_posted", tags={"provider": "launchdarkly"}
        )
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

    def test_launchdarkly_post_create_invalid_signature(self, mock_incr):
        with self.feature(self.features):
            sig = hmac_sha256_hex_digest(key="123", message=b"456")
            response = self.client.post(self.url, LD_REQUEST, headers={"X-LD-Signature": sig})
            assert response.status_code == 401
            mock_incr.reset_mock()
            assert mock_incr.call_count == 0

    def test_post_launchdarkly_deserialization_failed(self, mock_incr):
        signature = hmac_sha256_hex_digest(key="123", message=json.dumps({}).encode())
        FlagWebHookSigningSecretModel.objects.create(
            organization=self.organization, provider="launchdarkly", secret="123"
        )

        with self.feature(self.features):
            response = self.client.post(self.url, {}, headers={"X-LD-Signature": signature})
            assert response.status_code == 200
            assert FlagAuditLogModel.objects.count() == 0
            mock_incr.reset_mock()
            assert mock_incr.call_count == 0

    def test_post_invalid_provider(self, mock_incr):
        url = reverse(self.endpoint, args=(self.organization.slug, "test"))
        with self.feature(self.features):
            response = self.client.post(url, {})
            assert response.status_code == 404
            mock_incr.reset_mock()
            assert mock_incr.call_count == 0

    def test_post_disabled(self, mock_incr):
        response = self.client.post(self.url, data={})
        assert response.status_code == 404
        assert response.content == b'"Not enabled."'
        mock_incr.reset_mock()
        assert mock_incr.call_count == 0

    def test_post_missing_signature(self, mock_incr):
        with self.feature(self.features):
            response = self.client.post(self.url, {})
            assert response.status_code == 401, response.content
            mock_incr.reset_mock()
            assert mock_incr.call_count == 0


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
