from datetime import datetime, timezone

from django.urls import reverse
from rest_framework import status

from sentry.models.orgauthtoken import OrgAuthToken
from sentry.testutils.cases import APITestCase, PermissionTestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OrganizationAuthTokenDetailTest(APITestCase):
    endpoint = "sentry-api-0-org-auth-token-details"

    def test_simple(self):
        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        self.login_as(self.user)
        response = self.get_success_response(
            self.organization.slug, token.id, status_code=status.HTTP_200_OK
        )
        assert response.content

        res = response.data

        assert res.get("id") == str(token.id)
        assert res.get("name") == "token 1"
        assert res.get("token") is None
        assert res.get("tokenLastCharacters") == "xyz1"
        assert res.get("scopes") == ["org:ci"]
        assert res.get("dateCreated") is not None
        assert res.get("lastUsedDate") is None
        assert res.get("lastUsedProjectId") is None

    def test_last_used(self):
        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=datetime(2023, 1, 1, tzinfo=timezone.utc),
            project_last_used_id=self.project.id,
        )

        self.login_as(self.user)
        response = self.get_success_response(
            self.organization.slug, token.id, status_code=status.HTTP_200_OK
        )
        assert response.content

        res = response.data
        assert res.get("dateLastUsed") == datetime(2023, 1, 1, tzinfo=timezone.utc)
        assert res.get("projectLastUsedId") == str(self.project.id)

    def test_no_auth(self):
        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        response = self.get_error_response(self.organization.slug, token.id)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_other_org_token(self):
        other_org = self.create_organization()
        token = OrgAuthToken.objects.create(
            organization_id=other_org.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        self.login_as(self.user)
        response = self.get_error_response(other_org.slug, token.id)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_other_org(self):
        other_org = self.create_organization()
        token = OrgAuthToken.objects.create(
            organization_id=other_org.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        self.login_as(self.user)
        response = self.get_error_response(self.organization.slug, token.id)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_not_exists(self):
        self.login_as(self.user)
        response = self.get_error_response(self.organization.slug, 999999)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_deleted(self):
        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
            date_deactivated=datetime(2023, 1, 1, tzinfo=timezone.utc),
        )

        self.login_as(self.user)
        response = self.get_error_response(self.organization.slug, token.id)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@control_silo_test
class OrganizationAuthTokenEditTest(APITestCase):
    endpoint = "sentry-api-0-org-auth-token-details"
    method = "PUT"

    def test_simple(self):
        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )
        payload = {"name": "new token"}

        self.login_as(self.user)
        response = self.get_success_response(
            self.organization.slug, token.id, status_code=status.HTTP_204_NO_CONTENT, **payload
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

        tokenNew = OrgAuthToken.objects.get(id=token.id)
        assert tokenNew.name == "new token"
        assert tokenNew.token_hashed == token.token_hashed
        assert tokenNew.get_scopes() == token.get_scopes()

    def test_no_name(self):
        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )
        payload: dict[str, str] = {}

        self.login_as(self.user)
        response = self.get_error_response(
            self.organization.slug, token.id, status_code=status.HTTP_400_BAD_REQUEST, **payload
        )
        assert response.content
        assert response.data == {"detail": "The name cannot be blank."}

        tokenNew = OrgAuthToken.objects.get(id=token.id)
        assert tokenNew.name == "token 1"

    def test_name_too_long(self):
        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )
        payload: dict[str, str] = {"name": "a" * 300}

        self.login_as(self.user)
        response = self.get_error_response(
            self.organization.slug, token.id, status_code=status.HTTP_400_BAD_REQUEST, **payload
        )
        assert response.content
        assert response.data == {"detail": "The name cannot be longer than 255 characters."}

        tokenNew = OrgAuthToken.objects.get(id=token.id)
        assert tokenNew.name == "token 1"

    def test_blank_name(self):
        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )
        payload = {"name": ""}

        self.login_as(self.user)
        response = self.get_error_response(
            self.organization.slug, token.id, status_code=status.HTTP_400_BAD_REQUEST, **payload
        )
        assert response.content
        assert response.data == {"detail": "The name cannot be blank."}

        tokenNew = OrgAuthToken.objects.get(id=token.id)
        assert tokenNew.name == "token 1"

    def test_no_auth(self):
        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )
        payload: dict[str, str] = {}
        response = self.get_error_response(self.organization.slug, token.id, **payload)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_other_org_token(self):
        other_org = self.create_organization()
        payload = {"name": "test token"}
        token = OrgAuthToken.objects.create(
            organization_id=other_org.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        self.login_as(self.user)
        response = self.get_error_response(other_org.slug, token.id, **payload)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_other_org(self):
        other_org = self.create_organization()
        payload = {"name": "test token"}
        token = OrgAuthToken.objects.create(
            organization_id=other_org.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        self.login_as(self.user)
        response = self.get_error_response(self.organization.slug, token.id, **payload)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_not_exists(self):
        payload = {"name": "test token"}
        self.login_as(self.user)
        response = self.get_error_response(self.organization.slug, 999999, **payload)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_deleted(self):
        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
            date_deactivated=datetime(2023, 1, 1, tzinfo=timezone.utc),
        )

        payload = {"name": "test token"}
        self.login_as(self.user)
        response = self.get_error_response(self.organization.slug, token.id, **payload)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@control_silo_test
class OrganizationAuthTokenDeleteTest(APITestCase):
    endpoint = "sentry-api-0-org-auth-token-details"
    method = "DELETE"

    def test_simple(self):
        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        self.login_as(self.user)
        response = self.get_success_response(
            self.organization.slug, token.id, status_code=status.HTTP_204_NO_CONTENT
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

        tokenNew = OrgAuthToken.objects.get(id=token.id)
        assert tokenNew.name == "token 1"
        assert tokenNew.token_hashed == token.token_hashed
        assert tokenNew.get_scopes() == token.get_scopes()
        assert tokenNew.is_active() is False
        assert tokenNew.date_deactivated is not None

    def test_no_auth(self):
        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )
        response = self.get_error_response(self.organization.slug, token.id)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_other_org_token(self):
        other_org = self.create_organization()
        token = OrgAuthToken.objects.create(
            organization_id=other_org.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        self.login_as(self.user)
        response = self.get_error_response(other_org.slug, token.id)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_other_org(self):
        other_org = self.create_organization()
        token = OrgAuthToken.objects.create(
            organization_id=other_org.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        self.login_as(self.user)
        response = self.get_error_response(self.organization.slug, token.id)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_not_exists(self):
        self.login_as(self.user)
        response = self.get_error_response(self.organization.slug, 999999)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_deleted(self):
        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
            date_deactivated=datetime(2023, 1, 1, tzinfo=timezone.utc),
        )

        self.login_as(self.user)
        response = self.get_error_response(self.organization.slug, token.id)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@control_silo_test
class OrganizationAuthTokenDetailsPermissionTest(PermissionTestCase):
    putData = {"name": "token-1"}

    def setUp(self):
        super().setUp()

        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        self.path = reverse(
            "sentry-api-0-org-auth-token-details", args=[self.organization.slug, token.id]
        )

    def test_owner_can_get(self):
        self.assert_owner_can_access(self.path)

    def test_manager_can_get(self):
        self.assert_manager_can_access(self.path)

    def test_member_can_get(self):
        self.assert_member_can_access(self.path)

    def test_owner_can_put(self):
        self.assert_owner_can_access(
            self.path, method="PUT", data=self.putData, content_type="application/json"
        )

    def test_manager_can_put(self):
        self.assert_manager_can_access(
            self.path, method="PUT", data=self.putData, content_type="application/json"
        )

    def test_member_can_put(self):
        self.assert_member_can_access(
            self.path, method="PUT", data=self.putData, content_type="application/json"
        )

    def test_owner_can_delete(self):
        self.assert_owner_can_access(self.path, method="DELETE")

    def test_manager_can_delete(self):
        self.assert_manager_can_access(self.path, method="DELETE")

    def test_member_cannot_delete(self):
        self.assert_member_cannot_access(self.path, method="DELETE")
