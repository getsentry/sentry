from datetime import datetime, timezone

import pytest
from django.urls import reverse

from sentry.flags.endpoints.hooks import (
    DeserializationError,
    InvalidProvider,
    handle_flag_pole_event,
    handle_provider_event,
)
from sentry.flags.models import ACTION_MAP, CREATED_BY_TYPE_MAP, FlagAuditLogModel
from sentry.testutils.cases import APITestCase
from sentry.utils.security.orgauthtoken_token import hash_token


def test_handle_provider_event():
    result = handle_provider_event(
        "flag-pole",
        {
            "data": [
                {
                    "action": "created",
                    "flag": "test",
                    "created_at": "2024-01-01T00:00:00",
                    "created_by": "colton.allen@sentry.io",
                    "tags": {"commit_sha": "123"},
                }
            ]
        },
        1,
    )

    assert result[0]["action"] == ACTION_MAP["created"]
    assert result[0]["flag"] == "test"
    assert result[0]["created_at"] == datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    assert result[0]["created_by"] == "colton.allen@sentry.io"
    assert result[0]["created_by_type"] == CREATED_BY_TYPE_MAP["email"]
    assert result[0]["organization_id"] == 1
    assert result[0]["tags"] == {"commit_sha": "123"}


def test_handle_provider_event_invalid_provider():
    with pytest.raises(InvalidProvider):
        handle_provider_event("other", {}, 1)


def test_handle_flag_pole_event():
    result = handle_flag_pole_event(
        {
            "data": [
                {
                    "action": "created",
                    "flag": "test",
                    "created_at": "2024-01-01T00:00:00",
                    "created_by": "colton.allen@sentry.io",
                    "tags": {"commit_sha": "123"},
                }
            ]
        },
        1,
    )

    assert result[0]["action"] == ACTION_MAP["created"]
    assert result[0]["flag"] == "test"
    assert result[0]["created_at"] == datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    assert result[0]["created_by"] == "colton.allen@sentry.io"
    assert result[0]["created_by_type"] == CREATED_BY_TYPE_MAP["email"]
    assert result[0]["organization_id"] == 1
    assert result[0]["tags"] == {"commit_sha": "123"}


def test_handle_flag_pole_event_bad_request():
    try:
        handle_flag_pole_event({"data": [{}]}, 1)
    except DeserializationError as exc:
        assert exc.errors["data"][0]["action"][0].code == "required"
        assert exc.errors["data"][0]["flag"][0].code == "required"
        assert exc.errors["data"][0]["created_at"][0].code == "required"
        assert exc.errors["data"][0]["created_by"][0].code == "required"
        assert exc.errors["data"][0]["tags"][0].code == "required"
    else:
        assert False, "Expected deserialization error"


class OrganizationFlagsHooksEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-flag-hooks"

    def setUp(self):
        super().setUp()
        self.url = reverse(self.endpoint, args=(self.organization.slug, "flag-pole"))

    def test_post(self):
        token = "sntrys_abc123_xyz"
        self.create_org_auth_token(
            name="Test Token 1",
            token_hashed=hash_token(token),
            organization_id=self.organization.id,
            token_last_characters="xyz",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.post(
            self.url,
            data={
                "data": [
                    {
                        "action": "created",
                        "flag": "test",
                        "created_at": "2024-01-01T00:00:00",
                        "created_by": "colton.allen@sentry.io",
                        "tags": {"commit_sha": "123"},
                    }
                ]
            },
        )
        assert response.status_code == 200

        assert FlagAuditLogModel.objects.count() == 1
        flag = FlagAuditLogModel.objects.first()
        assert flag is not None
        assert flag.action == ACTION_MAP["created"]
        assert flag.flag == "test"
        assert flag.created_at == datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        assert flag.created_by == "colton.allen@sentry.io"
        assert flag.created_by_type == CREATED_BY_TYPE_MAP["email"]
        assert flag.organization_id == self.organization.id
        assert flag.tags == {"commit_sha": "123"}

    def test_post_unauthorized(self):
        response = self.client.post(self.url, data={})
        assert response.status_code == 401
