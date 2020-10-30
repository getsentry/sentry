from __future__ import absolute_import

import six

from base64 import b64encode

from django.core.urlresolvers import reverse

from sentry.models import OrganizationAvatar
from sentry.testutils import APITestCase


class OrganizationAvatarTest(APITestCase):
    def test_get(self):
        organization = self.organization  # force creation
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-avatar", kwargs={"organization_slug": organization.slug}
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data["id"] == six.text_type(organization.id)
        assert response.data["avatar"]["avatarType"] == "letter_avatar"
        assert response.data["avatar"]["avatarUuid"] is None

    def test_upload(self):
        organization = self.organization  # force creation
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-avatar", kwargs={"organization_slug": organization.slug}
        )
        response = self.client.put(
            url,
            data={
                "avatar_type": "upload",
                "avatar_photo": b64encode(self.load_fixture("avatar.jpg")),
            },
            format="json",
        )

        avatar = OrganizationAvatar.objects.get(organization=organization)
        assert response.status_code == 200, response.content
        assert avatar.get_avatar_type_display() == "upload"
        assert avatar.file

    def test_put_bad(self):
        organization = self.organization  # force creation
        OrganizationAvatar.objects.create(organization=organization)
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-avatar", kwargs={"organization_slug": organization.slug}
        )
        response = self.client.put(url, data={"avatar_type": "upload"}, format="json")

        avatar = OrganizationAvatar.objects.get(organization=organization)
        assert response.status_code == 400
        assert avatar.get_avatar_type_display() == "letter_avatar"

        response = self.client.put(url, data={"avatar_type": "foo"}, format="json")
        assert response.status_code == 400
        assert avatar.get_avatar_type_display() == "letter_avatar"

    def test_put_forbidden(self):
        organization = self.organization  # force creation
        user = self.create_user(email="a@example.com")

        self.login_as(user=user)
        url = reverse(
            "sentry-api-0-organization-avatar", kwargs={"organization_slug": organization.slug}
        )
        response = self.client.put(url, data={"avatar_type": "letter_avatar"}, format="json")

        assert response.status_code == 403
