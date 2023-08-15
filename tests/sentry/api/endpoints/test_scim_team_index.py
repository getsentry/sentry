from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse

from sentry.models import Team
from sentry.signals import receivers_raise_on_send
from sentry.testutils.cases import SCIMTestCase
from sentry.testutils.silo import region_silo_test

CREATE_TEAM_POST_DATA = {
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
    "displayName": "Test SCIM",
    "members": [],
}


@region_silo_test(stable=True)
class SCIMGroupIndexTests(SCIMTestCase):
    def setUp(self):
        super().setUp()
        self.url = reverse(
            "sentry-api-0-organization-scim-team-index", args=[self.organization.slug]
        )

    def test_group_index_empty(self):
        response = self.client.get(f"{self.url}?startIndex=1&count=100")
        correct_get_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 0,
            "startIndex": 1,
            "itemsPerPage": 0,
            "Resources": [],
        }
        assert response.status_code == 200, response.content
        assert response.data == correct_get_data

    @patch("sentry.scim.endpoints.teams.metrics")
    @override_settings(SENTRY_REGION="na")
    def test_scim_team_index_create(self, mock_metrics):
        with receivers_raise_on_send():
            response = self.client.post(self.url, CREATE_TEAM_POST_DATA)
        assert response.status_code == 201, response.content

        team_id = response.data["id"]
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "id": team_id,
            "displayName": "Test SCIM",
            "members": [],
            "meta": {"resourceType": "Group"},
        }

        assert Team.objects.filter(id=team_id).exists()
        assert Team.objects.get(id=team_id).slug == "test-scim"
        assert Team.objects.get(id=team_id).name == "Test SCIM"
        assert Team.objects.get(id=team_id).idp_provisioned
        assert len(Team.objects.get(id=team_id).member_set) == 0
        mock_metrics.incr.assert_called_with(
            "sentry.scim.team.provision",
        )

    def test_scim_team_index_populated(self):
        team = self.create_team(organization=self.organization)

        # test team index GET
        response = self.client.get(f"{self.url}?startIndex=1&count=100")
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
                    "displayName": team.name,
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

        response = self.client.get(f"{self.url}?startIndex=1&count=100")
        correct_get_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 1,
            "startIndex": 1,
            "itemsPerPage": 1,
            "Resources": [
                {
                    "displayName": team.name,
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

    def test_team_filter(self):
        response = self.client.get(
            f"{self.url}?startIndex=1&count=100&filter=displayName eq %22{self.team.name}%22"
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
                    "displayName": self.team.name,
                    "members": [
                        {"value": str(self.team.member_set[0].id), "display": "admin@localhost"}
                    ],
                    "meta": {"resourceType": "Group"},
                }
            ],
        }

    def test_team_filter_with_space(self):
        team = self.create_team(organization=self.organization, name="Name WithASpace")
        response = self.client.get(
            f"{self.url}?startIndex=1&count=100&filter=displayName eq %22{team.name}%22"
        )
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 1,
            "startIndex": 1,
            "itemsPerPage": 1,
            "Resources": [
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                    "id": str(team.id),
                    "displayName": team.name,
                    "members": [],
                    "meta": {"resourceType": "Group"},
                }
            ],
        }

    def test_team_filter_case_insensitive(self):
        team = self.create_team(organization=self.organization, name="Name WithASpace")
        response = self.client.get(
            f"{self.url}?startIndex=1&count=100&filter=displayName eq %22{team.name.upper()}%22"
        )
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 1,
            "startIndex": 1,
            "itemsPerPage": 1,
            "Resources": [
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                    "id": str(team.id),
                    "displayName": team.name,
                    "members": [],
                    "meta": {"resourceType": "Group"},
                }
            ],
        }

    def test_team_exclude_members_param(self):
        response = self.client.get(
            f"{self.url}?startIndex=1&count=100&filter=displayName eq %22{self.team.name}%22&excludedAttributes=members"
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
                    "displayName": self.team.name,
                    "meta": {"resourceType": "Group"},
                }
            ],
        }

    def test_scim_invalid_filter(self):
        response = self.client.get(f"{self.url}?startIndex=1&count=1&filter=bad filter eq 23")
        assert response.status_code == 400, response.data
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "scimType": "invalidFilter",
        }

    def test_scim_invalid_startIndex(self):
        response = self.client.get(f"{self.url}?startIndex=0")
        assert response.status_code == 400, response.data

    @override_settings(SENTRY_REGION="na")
    def test_scim_team_no_duplicate_names(self):
        self.create_team(organization=self.organization, name=CREATE_TEAM_POST_DATA["displayName"])
        response = self.client.post(self.url, CREATE_TEAM_POST_DATA)
        assert response.status_code == 409, response.content

    def test_scim_team_invalid_numerical_slug(self):
        bad_data = CREATE_TEAM_POST_DATA.copy()
        bad_data["displayName"] = "foo123"
        response = self.client.post(self.url, bad_data)
        assert response.status_code == 400
        assert (
            str(response.data["slug"][0])
            == "Enter a valid slug consisting of lowercase letters, underscores, or hyphens."
        )
