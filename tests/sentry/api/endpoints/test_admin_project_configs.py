from urllib import parse

from django.urls import reverse
from rest_framework import status

from sentry.relay import projectconfig_cache
from sentry.testutils import APITestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class AdminRelayProjectConfigsEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="example@example.com", is_superuser=False, is_staff=True, is_active=True
        )
        self.org = self.create_organization(owner=self.owner)
        self.first_team = self.create_team(organization=self.org)
        self.proj1 = self.create_project(
            name="proj1", organization=self.org, teams=[self.first_team]
        )
        self.proj2 = self.create_project(
            name="proj2", organization=self.org, teams=[self.first_team]
        )
        self.superuser = self.create_user(
            "superuser@example.com", is_superuser=True, is_staff=True, is_active=True
        )
        self.path = "sentry-api-0-internal-project-config"

        self.p1_pk = self.create_project_key(self.proj1)
        self.p2_pk = self.create_project_key(self.proj2)

        projectconfig_cache.set_many(
            {
                self.p1_pk.public_key: "proj1 config",
            }
        )

    def get_url(self, proj_id=None, key=None):
        query = {}
        if proj_id is not None:
            query["projectId"] = proj_id
        if key is not None:
            query["projectKey"] = key

        query_string = parse.urlencode(query)

        ret_val = reverse(self.path)
        ret_val += f"?{query_string}"
        return ret_val

    def test_normal_users_do_not_have_access(self):
        """
        Request denied for non super-users
        """
        self.login_as(self.owner)

        url = self.get_url(proj_id=self.proj1.id)
        response = self.client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_retrieving_project_configs(self):
        """
        Asking for a project will return all project configs from all public
        keys in redis
        """
        self.login_as(self.superuser, superuser=True)

        url = self.get_url(proj_id=self.proj1.id)
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        expected = {"configs": {self.p1_pk.public_key: "proj1 config"}}
        actual = response.json()
        assert actual == expected

    def test_retrieving_public_key_configs(self):
        """
        Asking for a particular public key will return only the project config
        for that public key
        """
        self.login_as(self.superuser, superuser=True)

        url = self.get_url(key=self.p1_pk.public_key)
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        expected = {"configs": {self.p1_pk.public_key: "proj1 config"}}
        actual = response.json()
        assert actual == expected

    def test_uncached_project(self):
        """
        Asking for a project that was not cached in redis will return
        an empty marker
        """
        expected = {"configs": {self.p2_pk.public_key: None}}

        self.login_as(self.superuser, superuser=True)

        url = self.get_url(proj_id=self.proj2.id)
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        actual = response.json()
        assert actual == expected

        url = self.get_url(key=self.p2_pk.public_key)
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        actual = response.json()
        assert actual == expected

    def test_inexistent_project(self):
        """
        Asking for an inexitent project will return 404
        """
        inexistent_project_id = 2 ^ 32
        self.login_as(self.superuser, superuser=True)

        url = self.get_url(proj_id=inexistent_project_id)
        response = self.client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_inexistent_key(self):
        """
        Asking for an inexistent project key will return an empty result
        """
        inexsitent_key = 123
        self.login_as(self.superuser, superuser=True)

        url = self.get_url(key=inexsitent_key)
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        expected = {"configs": {str(inexsitent_key): None}}
        actual = response.json()
        assert actual == expected
