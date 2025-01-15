from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class ShortIdLookupEndpointTest(APITestCase):
    def setUp(self):
        self.group = self.create_group(project=self.project, short_id=self.project.next_short_id())
        self.url = reverse(
            "sentry-api-0-short-id-lookup",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "issue_id": self.group.qualified_short_id,
            },
        )

    def test_simple(self) -> None:
        self.login_as(user=self.user)
        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["organizationSlug"] == self.organization.slug
        assert response.data["projectSlug"] == self.project.slug
        assert response.data["groupId"] == str(self.group.id)
        assert response.data["group"]["id"] == str(self.group.id)

    def test_access_non_member_project(self):
        # disable Open Membership
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        # user has no access to the first project
        user_no_team = self.create_user(is_superuser=False)
        self.create_member(
            user=user_no_team, organization=self.organization, role="member", teams=[]
        )
        self.login_as(user_no_team)

        response = self.client.get(self.url, format="json")
        assert response.status_code == 403, response.content
        assert response.data["detail"] == "You do not have permission to perform this action."
