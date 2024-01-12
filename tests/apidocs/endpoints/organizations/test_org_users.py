from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationUsersDocs(APIDocsTestCase):
    def setUp(self):
        self.owner_user = self.create_user("foo@localhost", username="foo")
        self.user_2 = self.create_user("bar@localhost", username="bar")

        self.org = self.create_organization(owner=self.owner_user)
        self.org.member_set.create(user_id=self.user_2.id)
        self.team = self.create_team(organization=self.org, members=[self.owner_user, self.user_2])
        self.project = self.create_project(teams=[self.team])

        self.login_as(user=self.user_2)
        self.url = reverse(
            "sentry-api-0-organization-users",
            kwargs={"organization_slug": self.org.slug},
        )

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
