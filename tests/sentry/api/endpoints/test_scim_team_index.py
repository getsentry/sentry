from django.urls import reverse

from sentry.models import Team, TeamStatus
from sentry.testutils import SCIMTestCase

CREATE_TEAM_POST_DATA = {
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
    "displayName": "Test SCIMv2",
    "members": [],
}


class SCIMGroupIndexTests(SCIMTestCase):
    def test_group_index_empty(self):
        url = reverse("sentry-api-0-organization-scim-team-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=1&count=100")
        correct_get_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 0,
            "startIndex": 1,
            "itemsPerPage": 0,
            "Resources": [],
        }
        assert response.status_code == 200, response.content
        assert response.data == correct_get_data

    def test_scim_team_index_create(self):
        # test team creation
        url = reverse(
            "sentry-api-0-organization-scim-team-index",
            args=[self.organization.slug],
        )
        response = self.client.post(url, CREATE_TEAM_POST_DATA)
        assert response.status_code == 201, response.content

        team_id = response.data["id"]
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "id": team_id,
            "displayName": "test-scimv2",
            "members": [],
            "meta": {"resourceType": "Group"},
        }
        assert Team.objects.get(id=team_id).exists()
        assert Team.objects.get(id=team_id).slug == "test-scimv2"
        assert Team.objects.get(id=team_id).name == "test-scimv2"
        assert Team.objects.get(id=team_id).members == []

        # assert that the team exists

    def test_scim_team_index_populated(self):
        team = self.create_team(organization=self.organization)

        # test team index GET
        url = reverse("sentry-api-0-organization-scim-team-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=1&count=100")
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 1,
            "startIndex": 1,
            "itemsPerPage": 1,
            "Resources": [
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                    "id": str(team.id),
                    "displayName": team.slug,
                    "members": [],
                    "meta": {"resourceType": "Group"},
                }
            ],
        }

    def test_scim_team_index_basic(self):
        # test index route returns with members
        team = self.create_team(organization=self.organization)
        member1 = self.create_member(
            user=self.create_user(), organization=self.organization, teams=[team]
        )
        member2 = self.create_member(
            user=self.create_user(), organization=self.organization, teams=[team]
        )

        url = reverse("sentry-api-0-organization-scim-team-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=1&count=100")
        correct_get_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 1,
            "startIndex": 1,
            "itemsPerPage": 1,
            "Resources": [
                {
                    "displayName": team.slug,
                    "id": str(team.id),
                    "members": [
                        {
                            "display": member1.get_email(),
                            "value": f"{member1.id}",
                        },
                        {
                            "display": member2.get_email(),
                            "value": f"{member2.id}",
                        },
                    ],
                    "meta": {"resourceType": "Group"},
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                }
            ],
        }
        assert response.status_code == 200, response.content
        assert response.data == correct_get_data

    def test_delete_team(self):
        team = self.create_team(organization=self.organization)
        url = reverse(
            "sentry-api-0-organization-scim-team-details", args=[self.organization.slug, team.id]
        )
        response = self.client.delete(url)
        assert response.status_code == 204, response.content

        assert Team.objects.get(id=team.id).status == TeamStatus.PENDING_DELETION

    def test_team_filter(self):
        url = reverse("sentry-api-0-organization-scim-team-index", args=[self.organization.slug])
        response = self.client.get(
            f"{url}?startIndex=1&count=100&filter=displayName eq %22{self.team.slug}%22"
        )
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 1,
            "startIndex": 1,
            "itemsPerPage": 1,
            "Resources": [
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                    "id": str(self.team.id),
                    "displayName": self.team.slug,
                    "members": [
                        {"value": str(self.team.member_set[0].id), "display": "admin@localhost"}
                    ],
                    "meta": {"resourceType": "Group"},
                }
            ],
        }

    def test_team_exclude_members_param(self):
        url = reverse("sentry-api-0-organization-scim-team-index", args=[self.organization.slug])
        response = self.client.get(
            f"{url}?startIndex=1&count=100&filter=displayName eq %22{self.team.slug}%22&excludedAttributes=members"
        )
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 1,
            "startIndex": 1,
            "itemsPerPage": 1,
            "Resources": [
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                    "id": str(self.team.id),
                    "displayName": self.team.slug,
                    "members": None,
                    "meta": {"resourceType": "Group"},
                }
            ],
        }

    def test_invalid_filter(self):
        url = reverse("sentry-api-0-organization-scim-team-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=1&count=1&filter=bad filter eq 23")
        assert response.status_code == 400, response.data
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "scimType": "invalidFilter",
        }
