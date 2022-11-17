from django.urls import reverse
from exam import fixture

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


class OrganizationTagKeyTestCase(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-tagkey-values"

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.day_ago = before_now(days=1)
        user = self.create_user()
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.create_member(organization=self.org, user=user, teams=[self.team])
        self.login_as(user=user)

    def get_response(self, key, **kwargs):
        return super().get_response(self.org.slug, key, **kwargs)

    def run_test(self, key, expected, **kwargs):
        response = self.get_success_response(key, **kwargs)
        assert [(val["value"], val["count"]) for val in response.data] == expected

    @fixture
    def project(self):
        return self.create_project(organization=self.org, teams=[self.team])

    @fixture
    def group(self):
        return self.create_group(project=self.project)


@region_silo_test
class OrganizationTagKeyValuesTest(OrganizationTagKeyTestCase):
    def test_simple(self):
        self.store_event(
            data={"timestamp": iso_format(self.day_ago), "tags": {"fruit": "apple"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "tags": {"fruit": "orange"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "tags": {"some_tag": "some_value"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "tags": {"fruit": "orange"}},
            project_id=self.project.id,
        )

        url = reverse(
            "sentry-api-0-organization-tagkey-values",
            kwargs={"organization_slug": self.org.slug, "key": "fruit"},
        )
        response = self.client.get(url + "?includeReplays=1", format="json")
        assert response.status_code == 200, response.content
        self.run_test("fruit", expected=[("orange", 2), ("apple", 1)])
