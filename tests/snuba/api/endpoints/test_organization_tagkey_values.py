from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class OrganizationTagKeyValuesTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-tagkey-values"

    def setUp(self):
        super(OrganizationTagKeyValuesTest, self).setUp()
        self.min_ago = before_now(minutes=1)
        self.day_ago = before_now(days=1)
        user = self.create_user()
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.create_member(organization=self.org, user=user, teams=[self.team])
        self.login_as(user=user)

    def get_response(self, key, **kwargs):
        return super(OrganizationTagKeyValuesTest, self).get_response(self.org.slug, key)

    def run_test(self, key, expected):
        response = self.get_valid_response(key)
        assert [(val["value"], val["count"]) for val in response.data] == expected

    @fixture
    def project(self):
        return self.create_project(organization=self.org, teams=[self.team])

    @fixture
    def group(self):
        return self.create_group(project=self.project)

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
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        self.run_test("fruit", expected=[("orange", 2), ("apple", 1)])

    def test_bad_key(self):
        response = self.get_response("fr uit")
        assert response.status_code == 400, response.content
        assert response.data == {"detail": 'Invalid tag key format for "fr uit"'}

    def test_snuba_column(self):
        self.store_event(
            data={"timestamp": iso_format(self.day_ago), "user": {"email": "foo@example.com"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "user": {"email": "bar@example.com"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=10)),
                "user": {"email": "baz@example.com"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=10)),
                "user": {"email": "baz@example.com"},
            },
            project_id=self.project.id,
        )
        self.run_test(
            "user.email",
            expected=[("baz@example.com", 2), ("bar@example.com", 1), ("foo@example.com", 1)],
        )

    def test_release(self):
        self.store_event(
            data={"timestamp": iso_format(self.day_ago), "tags": {"sentry:release": "3.1.2"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "tags": {"sentry:release": "4.1.2"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.day_ago), "tags": {"sentry:release": "3.1.2"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=10)),
                "tags": {"sentry:release": "5.1.2"},
            },
            project_id=self.project.id,
        )
        self.run_test("release", expected=[("5.1.2", 1), ("4.1.2", 1), ("3.1.2", 2)])

    def test_user_tag(self):
        self.store_event(
            data={"tags": {"sentry:user": "1"}, "timestamp": iso_format(self.day_ago)},
            project_id=self.project.id,
        )
        self.store_event(
            data={"tags": {"sentry:user": "2"}, "timestamp": iso_format(self.min_ago)},
            project_id=self.project.id,
        )
        self.store_event(
            data={"tags": {"sentry:user": "1"}, "timestamp": iso_format(self.day_ago)},
            project_id=self.project.id,
        )
        self.store_event(
            data={"tags": {"sentry:user": "3"}, "timestamp": iso_format(before_now(seconds=10))},
            project_id=self.project.id,
        )
        self.run_test("user", expected=[("3", 1), ("2", 1), ("1", 2)])

    def test_project_id(self):
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        self.store_event(data={"timestamp": iso_format(self.day_ago)}, project_id=self.project.id)
        self.store_event(data={"timestamp": iso_format(self.min_ago)}, project_id=self.project.id)
        self.store_event(data={"timestamp": iso_format(self.day_ago)}, project_id=other_project.id)
        self.run_test("project.id", expected=[])

    def test_array_column(self):
        for i in range(3):
            self.store_event(
                data={"timestamp": iso_format(self.day_ago)}, project_id=self.project.id
            )
        self.run_test("error.type", expected=[])

    def test_no_projects(self):
        self.run_test("fruit", expected=[])
