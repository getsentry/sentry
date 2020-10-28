from __future__ import absolute_import

import six

from base64 import b64encode

from django.core.urlresolvers import reverse

from sentry.models import TeamAvatar
from sentry.testutils import APITestCase


class TeamAvatarTest(APITestCase):
    def test_get(self):
        team = self.team  # force creation
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-team-avatar",
            kwargs={"organization_slug": team.organization.slug, "team_slug": team.slug},
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data["id"] == six.text_type(team.id)
        assert response.data["avatar"]["avatarType"] == "letter_avatar"
        assert response.data["avatar"]["avatarUuid"] is None

    def test_upload(self):
        team = self.team  # force creation
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-team-avatar",
            kwargs={"organization_slug": team.organization.slug, "team_slug": team.slug},
        )
        response = self.client.put(
            url,
            data={
                "avatar_type": "upload",
                "avatar_photo": b64encode(self.load_fixture("avatar.jpg")),
            },
            format="json",
        )

        avatar = TeamAvatar.objects.get(team=team)
        assert response.status_code == 200, response.content
        assert avatar.get_avatar_type_display() == "upload"
        assert avatar.file

    def test_put_bad(self):
        team = self.team  # force creation
        TeamAvatar.objects.create(team=team)
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-team-avatar",
            kwargs={"organization_slug": team.organization.slug, "team_slug": team.slug},
        )
        response = self.client.put(url, data={"avatar_type": "upload"}, format="json")

        avatar = TeamAvatar.objects.get(team=team)
        assert response.status_code == 400
        assert avatar.get_avatar_type_display() == "letter_avatar"

        response = self.client.put(url, data={"avatar_type": "foo"}, format="json")
        assert response.status_code == 400
        assert avatar.get_avatar_type_display() == "letter_avatar"

    def test_put_forbidden(self):
        team = self.team  # force creation
        user = self.create_user(email="a@example.com")

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-team-avatar",
            kwargs={"organization_slug": team.organization.slug, "team_slug": team.slug},
        )
        response = self.client.put(url, data={"avatar_type": "gravatar"}, format="json")

        assert response.status_code == 403
