from __future__ import absolute_import

import six

from base64 import b64encode

from django.core.urlresolvers import reverse

from sentry.models import ProjectAvatar
from sentry.testutils import APITestCase


class ProjectAvatarTest(APITestCase):
    def test_get(self):
        project = self.project  # force creation
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-avatar",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data["id"] == six.text_type(project.id)
        assert response.data["avatar"]["avatarType"] == "letter_avatar"
        assert response.data["avatar"]["avatarUuid"] is None

    def test_upload(self):
        project = self.project  # force creation
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-avatar",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.put(
            url,
            data={
                "avatar_type": "upload",
                "avatar_photo": b64encode(self.load_fixture("avatar.jpg")),
            },
            format="json",
        )

        avatar = ProjectAvatar.objects.get(project=project)
        assert response.status_code == 200, response.content
        assert avatar.get_avatar_type_display() == "upload"
        assert avatar.file

    def test_put_bad(self):
        project = self.project  # force creation
        ProjectAvatar.objects.create(project=project)
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-avatar",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.put(url, data={"avatar_type": "upload"}, format="json")

        avatar = ProjectAvatar.objects.get(project=project)
        assert response.status_code == 400
        assert avatar.get_avatar_type_display() == "letter_avatar"

        response = self.client.put(url, data={"avatar_type": "foo"}, format="json")
        assert response.status_code == 400
        assert avatar.get_avatar_type_display() == "letter_avatar"

    def test_put_forbidden(self):
        project = self.project  # force creation
        user = self.create_user(email="a@example.com")

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-project-avatar",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.put(url, data={"avatar_type": "gravatar"}, format="json")

        assert response.status_code == 403
