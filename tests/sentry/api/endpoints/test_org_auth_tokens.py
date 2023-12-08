from typing import Dict

from django.urls import reverse
from rest_framework import status

from sentry import options
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.testutils.cases import APITestCase, PermissionTestCase
from sentry.testutils.silo import control_silo_test, create_test_regions
from sentry.types.region import get_region_by_name
from sentry.utils.security.orgauthtoken_token import parse_token


@control_silo_test
class OrgAuthTokensListTest(APITestCase):
    endpoint = "sentry-api-0-org-auth-tokens"

    def test_simple(self):
        other_org = self.create_organization()
        token1 = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )
        token2 = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 2",
            token_hashed="ABCDEF2",
            token_last_characters="xyz2",
            scope_list=["org:ci"],
            date_last_used="2023-01-02T00:00:00.000Z",
        )
        token3 = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 3",
            token_hashed="ABCDEF3",
            token_last_characters="xyz3",
            scope_list=["org:ci"],
            date_last_used="2023-01-01T00:00:00.000Z",
        )
        # Deleted tokens are not returned
        OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 4",
            token_hashed="ABCDEF4",
            token_last_characters="xyz3",
            scope_list=["org:ci"],
            date_deactivated="2023-01-01T00:00:00.000Z",
        )
        # tokens from other org are not returned
        OrgAuthToken.objects.create(
            organization_id=other_org.id,
            name="token 5",
            token_hashed="ABCDEF5",
            token_last_characters="xyz3",
            scope_list=["org:ci"],
        )

        self.login_as(self.user)
        response = self.get_success_response(self.organization.slug, status_code=status.HTTP_200_OK)
        assert response.content
        assert len(response.data) == 3
        assert list(map(lambda token: token.get("id"), response.data)) == [
            str(token2.id),
            str(token3.id),
            str(token1.id),
        ]
        assert response.data[0].get("token") is None
        assert response.data[1].get("token") is None
        assert response.data[2].get("token") is None

    def test_never_cache(self):
        OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )
        OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 2",
            token_hashed="ABCDEF2",
            token_last_characters="xyz2",
            scope_list=["org:ci"],
            date_last_used="2023-01-02T00:00:00.000Z",
        )

        self.login_as(self.user)
        response = self.get_success_response(self.organization.slug, status_code=status.HTTP_200_OK)
        assert response.content
        assert (
            response.get("cache-control")
            == "max-age=0, no-cache, no-store, must-revalidate, private"
        )

    def test_no_auth(self):
        response = self.get_error_response(self.organization.slug)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_other_org(self):
        other_org = self.create_organization()
        self.login_as(self.user)
        response = self.get_error_response(other_org.slug)
        assert response.status_code == status.HTTP_403_FORBIDDEN


@control_silo_test(regions=create_test_regions("us"))
class OrgAuthTokenCreateTest(APITestCase):
    endpoint = "sentry-api-0-org-auth-tokens"
    method = "POST"

    def test_simple(self):
        payload = {"name": "test token"}

        self.login_as(self.user)
        response = self.get_success_response(
            self.organization.slug, status_code=status.HTTP_201_CREATED, **payload
        )
        assert response.content

        token = response.data
        assert token.get("token") is not None
        assert token.get("tokenLastCharacters") is not None
        assert token.get("dateCreated") is not None
        assert token.get("dateLastUsed") is None
        assert token.get("projectLastUsed") is None
        assert token.get("scopes") == ["org:ci"]
        assert token.get("name") == "test token"

        tokenDb = OrgAuthToken.objects.get(id=token.get("id"))
        assert tokenDb.name == "test token"
        assert tokenDb.token_hashed is not None
        assert tokenDb.token_hashed != token.get("token")
        assert tokenDb.get_scopes() == token.get("scopes")
        assert tokenDb.created_by.id == self.user.id

        # Assert that region and control URLs are both set correctly
        token_payload = parse_token(token=token.get("token"))
        assert token_payload.get("region_url", None)
        assert token_payload.get("region_url") == get_region_by_name(name="us").address
        assert token_payload.get("url") == options.get("system.url-prefix")

    def test_no_name(self):
        payload: Dict[str, str] = {}

        self.login_as(self.user)
        response = self.get_error_response(
            self.organization.slug, status_code=status.HTTP_400_BAD_REQUEST, **payload
        )
        assert response.content
        assert response.data == {"detail": "The name cannot be blank."}

    def test_blank_name(self):
        payload = {"name": ""}

        self.login_as(self.user)
        response = self.get_error_response(
            self.organization.slug, status_code=status.HTTP_400_BAD_REQUEST, **payload
        )
        assert response.content
        assert response.data == {"detail": "The name cannot be blank."}

    def test_name_too_long(self):
        payload = {"name": "a" * 300}

        self.login_as(self.user)
        response = self.get_error_response(
            self.organization.slug, status_code=status.HTTP_400_BAD_REQUEST, **payload
        )
        assert response.content
        assert response.data == {"detail": "The name cannot be longer than 255 characters."}

    def test_no_auth(self):
        response = self.get_error_response(self.organization.slug)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_other_org(self):
        other_org = self.create_organization()
        payload = {"name": "test token"}

        self.login_as(self.user)
        response = self.get_error_response(other_org.slug, **payload)
        assert response.status_code == status.HTTP_403_FORBIDDEN


@control_silo_test
class OrgAuthTokensPermissionTest(PermissionTestCase):
    postData = {"name": "token-1"}

    def setUp(self):
        super().setUp()
        self.path = reverse("sentry-api-0-org-auth-tokens", args=[self.organization.slug])

    def test_owner_can_get(self):
        self.assert_owner_can_access(self.path)

    def test_manager_can_get(self):
        self.assert_manager_can_access(self.path)

    def test_member_can_get(self):
        self.assert_member_can_access(self.path)

    def test_owner_can_post(self):
        self.assert_owner_can_access(self.path, method="POST", data=self.postData)

    def test_manager_can_post(self):
        self.assert_manager_can_access(self.path, method="POST", data=self.postData)

    def test_member_can_post(self):
        self.assert_member_can_access(self.path, method="POST", data=self.postData)
