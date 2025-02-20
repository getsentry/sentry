from datetime import timedelta

from django.utils import timezone

from sentry.models.apiapplication import ApiApplication
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


class ApiAuthorizationsTest(APITestCase):
    endpoint = "sentry-api-0-api-authorizations"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


@control_silo_test
class ApiAuthorizationsListTest(ApiAuthorizationsTest):
    def test_simple(self):
        app = ApiApplication.objects.create(name="test", owner=self.user)
        auth = ApiAuthorization.objects.create(application=app, user=self.user)
        ApiAuthorization.objects.create(
            application=app, user=self.create_user("example@example.com")
        )

        response = self.get_success_response()
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(auth.id)
        assert response.data[0]["organization"] is None

    def test_org_level_auth(self):
        org = self.create_organization(owner=self.user, slug="test-org-slug")
        app = ApiApplication.objects.create(
            name="test", owner=self.user, requires_org_level_access=True
        )
        ApiAuthorization.objects.create(application=app, user=self.user, organization_id=org.id)

        response = self.get_success_response()
        assert len(response.data) == 1
        assert response.data[0]["organization"]["slug"] == org.slug


@control_silo_test
class ApiAuthorizationsDeleteTest(ApiAuthorizationsTest):
    method = "delete"

    def setUp(self):
        super().setUp()
        self.user = self.create_user(email="test@example.com")
        self.login_as(user=self.user)

        self.application = ApiApplication.objects.create(owner=self.create_user(), name="test")
        self.authorization = ApiAuthorization.objects.create(
            user=self.user,
            application=self.application,
        )

    def test_simple(self):
        app = ApiApplication.objects.create(name="test", owner=self.user)
        auth = ApiAuthorization.objects.create(application=app, user=self.user)
        token = ApiToken.objects.create(application=app, user=self.user)

        self.get_success_response(authorization=auth.id, status_code=204)
        assert not ApiAuthorization.objects.filter(id=auth.id).exists()
        assert not ApiToken.objects.filter(id=token.id).exists()

    def test_with_org(self):
        org1 = self.organization
        org2 = self.create_organization(owner=self.user, slug="test-org-2")
        app_with_org = ApiApplication.objects.create(
            name="test-app", owner=self.user, requires_org_level_access=True
        )
        org1_auth = ApiAuthorization.objects.create(
            application=app_with_org, user=self.user, organization_id=org1.id
        )
        org2_auth = ApiAuthorization.objects.create(
            application=app_with_org, user=self.user, organization_id=org2.id
        )
        org1_token = ApiToken.objects.create(
            application=app_with_org, user=self.user, scoping_organization_id=org1.id
        )
        org2_token = ApiToken.objects.create(
            application=app_with_org, user=self.user, scoping_organization_id=org2.id
        )

        self.get_success_response(authorization=org1_auth.id, status_code=204)
        assert not ApiAuthorization.objects.filter(id=org1_auth.id).exists()
        assert not ApiToken.objects.filter(id=org1_token.id).exists()

        assert ApiAuthorization.objects.filter(id=org2_auth.id).exists()
        assert ApiToken.objects.filter(id=org2_token.id).exists()

    def test_delete_authorization_cleans_up_grants(self):
        # Create an API grant associated with this authorization
        grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri="https://example.com",
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        # Create an API token associated with this authorization
        token = ApiToken.objects.create(
            user=self.user,
            application=self.application,
        )

        # Make the delete request
        self.get_success_response(
            authorization=self.authorization.id,
            status_code=204,
        )

        # Verify the authorization is deleted
        assert not ApiAuthorization.objects.filter(id=self.authorization.id).exists()

        # Verify associated grants are deleted
        assert not ApiGrant.objects.filter(id=grant.id).exists()

        # Verify associated tokens are deleted
        assert not ApiToken.objects.filter(id=token.id).exists()

    def test_delete_authorization_with_no_grants(self):
        """Test that deletion works when there are no associated grants"""
        self.get_success_response(
            authorization=self.authorization.id,
            status_code=204,
        )
        assert not ApiAuthorization.objects.filter(id=self.authorization.id).exists()

    def test_delete_authorization_with_organization_scoped_grants(self):
        """Test that only grants for the specific org are deleted"""
        org1 = self.create_organization()
        org2 = self.create_organization()

        # Create grants for different orgs
        grant1 = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            organization_id=org1.id,
            redirect_uri="https://example.com",
        )
        grant2 = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            organization_id=org2.id,
            redirect_uri="https://example.com",
        )

        # Create authorization for org1
        auth1 = ApiAuthorization.objects.create(
            user=self.user,
            application=self.application,
            organization_id=org1.id,
        )

        # Delete authorization for org1
        self.get_success_response(
            authorization=auth1.id,
            status_code=204,
        )

        # Verify only org1's grant is deleted
        assert not ApiGrant.objects.filter(id=grant1.id).exists()
        assert ApiGrant.objects.filter(id=grant2.id).exists()
