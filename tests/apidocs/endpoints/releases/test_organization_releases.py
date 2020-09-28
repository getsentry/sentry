from __future__ import absolute_import

from datetime import datetime

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from sentry.models import Release
from tests.apidocs.util import APIDocsTestCase


class OrganizationReleasesDocsTest(APIDocsTestCase):
    def setUp(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org2 = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        self.project1 = self.create_project(teams=[team1], organization=org)
        self.project2 = self.create_project(teams=[team2], organization=org2)
        self.project3 = self.create_project(teams=[team1], organization=org)

        self.create_member(teams=[team1], user=user, organization=org)

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
        pass

    def test_post(self):
        data = {"version": "1.2.1", "projects": [self.project3.slug, self.project2.slug]}
        response = self.client.post(self.url, data)
        request = RequestFactory().post(self.url, data)

        self.validate_schema(request, response)
