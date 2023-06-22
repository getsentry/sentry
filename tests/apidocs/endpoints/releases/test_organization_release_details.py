from datetime import datetime

from django.db.models import F
from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.models import Organization
from sentry.services.hybrid_cloud.organization_actions.impl import (
    update_organization_with_outbox_message,
)
from sentry.testutils.silo import region_silo_test


def set_joinleave_for_org(*, org: Organization, enabled=True):
    flags = F("flags").bitor(Organization.flags.allow_joinleave)

    if not enabled:
        flags = F("flags").bitand(~Organization.flags.allow_joinleave)

    update_organization_with_outbox_message(
        org_id=org.id,
        update_data={"flags": flags},
    )
    org.refresh_from_db()


@region_silo_test
class OrganizationReleaseDetailsDocsTest(APIDocsTestCase):
    def setUp(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org2 = self.create_organization()
        set_joinleave_for_org(org=org, enabled=False)

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        self.project1 = self.create_project(teams=[team1], organization=org)
        self.project2 = self.create_project(teams=[team2], organization=org2)
        self.project3 = self.create_project(teams=[team1], organization=org)

        self.create_member(teams=[team1], user=user, organization=org)

        self.login_as(user=user)
        release = self.create_release(
            project=self.project1, version="1", date_added=datetime(2013, 8, 13, 3, 8, 24, 880386)
        )

        self.url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_put(self):
        data = {"projects": [self.project3.slug]}
        response = self.client.put(self.url, data)
        request = RequestFactory().put(self.url, data)

        self.validate_schema(request, response)
