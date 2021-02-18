from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.models import OrganizationMember, ExternalUser


class ExternalUserTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.organization_member = OrganizationMember.objects.get(user=self.user)
        self.url = reverse(
            "sentry-api-0-external-user",
            args=[self.org.slug, self.organization_member.id],
        )

    def test_basic_post(self):
        data = {"externalName": "@NisanthanNanthakumar", "provider": "github"}
        response = self.client.post(self.url, data)
        assert response.status_code == 201, response.content
        assert response.data == {
            "id": str(response.data["id"]),
            "teamId": str(self.team.id),
            **data,
        }

    def test_missing_provider(self):
        response = self.client.post(self.url, {"externalName": "@NisanthanNanthakumar"})
        assert response.status_code == 400
        assert response.data == {"provider": ["This field is required."]}

    def test_missing_externalName(self):
        response = self.client.post(self.url, {"provider": "gitlab"})
        assert response.status_code == 400
        assert response.data == {"externalName": ["This field is required."]}

    def test_invalid_provider(self):
        data = {"externalName": "@NisanthanNanthakumar", "provider": "git"}
        response = self.client.post(self.url, data)
        assert response.status_code == 400
        assert response.data == {"provider": ['"git" is not a valid choice.']}

    def test_create_existing_association(self):
        self.external_user = ExternalUser.objects.create(
            organizationmember_id=str(self.organization_member.id),
            provider=ExternalUser.get_provider_enum("github"),
            external_name="@NisanthanNanthakumar",
        )
        data = {
            "externalName": self.external_user.external_name,
            "provider": ExternalUser.get_provider_string(self.external_user.provider),
        }
        response = self.client.post(self.url, data)
        assert response.status_code == 200
        assert response.data == {
            "id": str(self.external_user.id),
            "organizationMemberId": str(self.external_user.organizationmember_id),
            **data,
        }
