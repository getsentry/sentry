from urllib.parse import quote

from django.urls import reverse

from sentry.flags.endpoints.hooks import is_valid_token
from sentry.flags.models import ACTION_MAP, CREATED_BY_TYPE_MAP, FlagAuditLogModel
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.security.orgauthtoken_token import hash_token


class OrganizationFlagsHooksEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-flag-hooks"

    def setUp(self):
        super().setUp()
        token_str = "sntrys+_abc123_xy/3_*z"
        self.token = quote(token_str)
        self.create_org_auth_token(
            name="Test Token 1",
            token_hashed=hash_token(token_str),
            organization_id=self.organization.id,
            token_last_characters="xyz",
            scope_list=["org:ci"],
            date_last_used=None,
        )
        self.url = reverse(self.endpoint, args=(self.organization.slug, "launchdarkly", self.token))

    @property
    def features(self):
        return {"organizations:feature-flag-audit-log": True}

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

        with self.feature(self.features):
            response = self.client.post(self.url, request_data)

        assert response.status_code == 200
        assert FlagAuditLogModel.objects.count() == 2
        flag = FlagAuditLogModel.objects.first()
        assert flag is not None
        assert flag.action == ACTION_MAP["created"]
        assert flag.flag == "test flag"
        assert flag.created_by == "michelle@example.com"
        assert flag.created_by_type == CREATED_BY_TYPE_MAP["email"]
        assert flag.organization_id == self.organization.id
        assert flag.tags is not None
        assert flag.tags["description"] == "flag was created"

    def test_post_launchdarkly_deserialization_failed(self):
        with self.feature(self.features):
            response = self.client.post(self.url, {})
            assert response.status_code == 200
            assert FlagAuditLogModel.objects.count() == 0

    def test_post_invalid_provider(self):
        url = reverse(self.endpoint, args=(self.organization.slug, "test", self.token))
        with self.feature(self.features):
            response = self.client.post(url, {})
            assert response.status_code == 404

    def test_post_invalid_token(self):
        url = reverse(self.endpoint, args=(self.organization.slug, "launchdarkly", "wrong"))
        with self.feature(self.features):
            response = self.client.post(url, {})
            assert response.status_code == 403

    def test_post_cross_org_token(self):
        other_org = self.create_organization()
        self.create_org_auth_token(
            name="Test Token 1",
            token_hashed=hash_token("abc"),
            organization_id=other_org.id,
            token_last_characters="xyz",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        url = reverse(self.endpoint, args=(self.organization.slug, "launchdarkly", "abc"))
        with self.feature(self.features):
            response = self.client.post(url, {})
            assert response.status_code == 403

    def test_post_disabled(self):
        response = self.client.post(self.url, data={})
        assert response.status_code == 404
        assert response.content == b'"Not enabled."'


@django_db_all
@assume_test_silo_mode(SiloMode.CONTROL)
def test_is_valid_token():
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
    assert is_valid_token(1234, token_encoded) is True


@django_db_all
@assume_test_silo_mode(SiloMode.CONTROL)
def test_is_valid_token_invalid_token():
    assert is_valid_token(1234, quote("sntrys+_abc123_xyz")) is False
