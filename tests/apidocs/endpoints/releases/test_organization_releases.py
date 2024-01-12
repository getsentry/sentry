from datetime import datetime

from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.models.release import Release
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationReleasesDocsTest(APIDocsTestCase):
    def setUp(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization(owner=user, name="blah")
        org2 = self.create_organization(owner=user, name="bloop")

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)
        self.create_team_membership(team1, user=user)
        self.create_team_membership(team2, user=user)

        self.project1 = self.create_project(teams=[team1], organization=org)
        self.project2 = self.create_project(teams=[team2], organization=org2)
        self.project3 = self.create_project(teams=[team1], organization=org)

        self.login_as(user=user)

        release1 = Release.objects.create(
            organization_id=org.id, version="1", date_added=datetime(2013, 8, 13, 3, 8, 24, 880386)
        )
        release1.add_project(self.project1)

        release2 = Release.objects.create(
            organization_id=org2.id, version="2", date_added=datetime(2013, 8, 14, 3, 8, 24, 880386)
        )
        release2.add_project(self.project2)

        self.url = reverse(
            "sentry-api-0-organization-releases", kwargs={"organization_slug": org.slug}
        )

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_post(self):
        data = {"version": "1.2.1", "projects": [self.project3.slug]}
        response = self.client.post(self.url, data)
        request = RequestFactory().post(self.url, data)

        self.validate_schema(request, response)
