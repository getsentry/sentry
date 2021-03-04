from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.models import OrganizationMember


class ExternalUserTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(
            "sentry-api-0-organization-external-user",
            args=[self.organization.slug],
        )
        self.organization_member = OrganizationMember.objects.get(user=self.user)
        self.data = {
            "externalName": "@NisanthanNanthakumar",
            "provider": "github",
            "memberId": self.organization_member.id,
        }

    def test_basic_post(self):
        with self.feature({"organizations:external-user-associations": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201, response.content
        assert response.data == {
            **self.data,
            "id": str(response.data["id"]),
            "memberId": str(self.organization_member.id),
        }

    def test_without_feature_flag(self):
        response = self.client.post(self.url, self.data)
        assert response.status_code == 403
        assert response.data == {"detail": "You do not have permission to perform this action."}

    def test_missing_provider(self):
        self.data.pop("provider")
        with self.feature({"organizations:external-user-associations": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 400
        assert response.data == {"provider": ["This field is required."]}

    def test_missing_externalName(self):
        self.data.pop("externalName")
        with self.feature({"organizations:external-user-associations": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 400
        assert response.data == {"externalName": ["This field is required."]}

    def test_missing_memberId(self):
        self.data.pop("memberId")
        with self.feature({"organizations:external-user-associations": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 400
        assert response.data == {"memberId": ["This field is required."]}

    def test_invalid_provider(self):
        self.data.update(provider="unknown")
        with self.feature({"organizations:external-user-associations": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 400
        assert response.data == {"provider": ['"unknown" is not a valid choice.']}

    def test_create_existing_association(self):
        self.external_user = self.create_external_user(
            self.user, self.organization, external_name=self.data["externalName"]
        )

        with self.feature({"organizations:external-user-associations": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 200
        assert response.data == {
            **self.data,
            "id": str(self.external_user.id),
            "memberId": str(self.external_user.organizationmember_id),
        }
