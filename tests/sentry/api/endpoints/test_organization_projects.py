from django.urls import reverse

from sentry.models.apikey import ApiKey
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class OrganizationProjectsTestBase(APITestCase):
    endpoint = "sentry-api-0-organization-projects"

    @staticmethod
    def check_valid_response(response, expected_projects):
        assert [project.id for project in expected_projects] == [
            int(project_resp["id"]) for project_resp in response.data
        ]

    def test_api_key(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            key = ApiKey.objects.create(
                organization_id=self.organization.id, scope_list=["org:read"]
            )

        project = self.create_project(teams=[self.team])

        path = reverse(self.endpoint, args=[self.organization.slug])
        response = self.client.get(
            path,
            HTTP_AUTHORIZATION=self.create_basic_auth_header(key.key),
        )
        self.check_valid_response(response, [project])


class OrganizationProjectsTest(OrganizationProjectsTestBase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self):
        project = self.create_project(teams=[self.team])

        response = self.get_success_response(self.organization.slug)
        self.check_valid_response(response, [project])
        assert self.client.session["activeorg"] == self.organization.slug

    def test_superuser(self):
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)
        project = self.create_project(teams=[self.team])

        response = self.get_success_response(self.organization.slug)
        self.check_valid_response(response, [project])

    def test_staff(self):
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)
        project = self.create_project(teams=[self.team])

        response = self.get_success_response(self.organization.slug)
        self.check_valid_response(response, [project])

    def test_with_stats(self):
        projects = [self.create_project(teams=[self.team])]

        response = self.get_success_response(
            self.organization.slug, qs_params={"statsPeriod": "24h"}
        )
        self.check_valid_response(response, projects)
        assert "stats" in response.data[0]

        response = self.get_success_response(
            self.organization.slug, qs_params={"statsPeriod": "14d"}
        )
        self.check_valid_response(response, projects)
        assert "stats" in response.data[0]

        response = self.get_success_response(self.organization.slug, qs_params={"statsPeriod": ""})
        self.check_valid_response(response, projects)
        assert "stats" not in response.data[0]

        self.get_error_response(
            self.organization.slug, qs_params={"statsPeriod": "48h"}, status_code=400
        )

    def test_search(self):
        project = self.create_project(teams=[self.team], name="bar", slug="bar")

        response = self.get_success_response(self.organization.slug, qs_params={"query": "bar"})
        self.check_valid_response(response, [project])

        response = self.get_success_response(self.organization.slug, qs_params={"query": "baz"})
        self.check_valid_response(response, [])

    def test_search_by_ids(self):
        project_bar = self.create_project(teams=[self.team], name="bar", slug="bar")
        project_foo = self.create_project(teams=[self.team], name="foo", slug="foo")
        self.create_project(teams=[self.team], name="baz", slug="baz")

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": f"id:{project_foo.id}"}
        )
        self.check_valid_response(response, [project_foo])

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": f"id:{project_bar.id} id:{project_foo.id}"}
        )
        self.check_valid_response(response, [project_bar, project_foo])

    def test_search_by_ids_invalid(self):
        response = self.get_error_response(self.organization.slug, qs_params={"query": "id:"})
        assert response.status_code == 400

        response = self.get_error_response(self.organization.slug, qs_params={"query": "id:bababa"})
        assert response.status_code == 400

    def test_search_by_slugs(self):
        project_bar = self.create_project(teams=[self.team], name="bar", slug="bar")
        project_foo = self.create_project(teams=[self.team], name="foo", slug="foo")
        self.create_project(teams=[self.team], name="baz", slug="baz")

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": f"slug:{project_foo.slug}"}
        )
        self.check_valid_response(response, [project_foo])

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"query": f"slug:{project_bar.slug} slug:{project_foo.slug}"},
        )
        self.check_valid_response(response, [project_bar, project_foo])

    def test_bookmarks_appear_first_across_pages(self):
        projects = [
            self.create_project(teams=[self.team], name=i, slug=f"project-{i}") for i in range(3)
        ]
        projects.sort(key=lambda project: project.slug)

        response = self.get_success_response(self.organization.slug)
        self.check_valid_response(response, [project for project in projects])

        response = self.get_success_response(self.organization.slug, qs_params={"per_page": "2"})
        self.check_valid_response(response, [project for project in projects[:2]])

        self.create_project_bookmark(projects[-1], user=self.user)
        # Move the bookmarked project to the front
        projects.insert(0, projects.pop())
        response = self.get_success_response(self.organization.slug)
        self.check_valid_response(response, [project for project in projects])

        # Make sure that it's at the front when on the second page as well
        response = self.get_success_response(self.organization.slug, qs_params={"per_page": "2"})
        self.check_valid_response(response, [project for project in projects[:2]])

        # Make sure that other user's bookmarks don't interfere with this user
        other_user = self.create_user()
        self.create_project_bookmark(projects[1], user=other_user)
        response = self.get_success_response(self.organization.slug)
        self.check_valid_response(response, [project for project in projects])

    def test_team_filter(self):
        other_team = self.create_team(organization=self.organization)

        project_bar = self.create_project(teams=[self.team], name="bar", slug="bar")
        project_foo = self.create_project(teams=[other_team], name="foo", slug="foo")
        project_baz = self.create_project(teams=[other_team], name="baz", slug="baz")

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": f"team:{self.team.slug}"}
        )
        self.check_valid_response(response, [project_bar])

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": f"!team:{self.team.slug}"}
        )
        self.check_valid_response(response, [project_baz, project_foo])

    def test_all_projects(self):
        other_team = self.create_team(organization=self.organization)

        project_bar = self.create_project(teams=[self.team], name="bar", slug="bar")
        project_foo = self.create_project(teams=[other_team], name="foo", slug="foo")
        project_baz = self.create_project(teams=[other_team], name="baz", slug="baz")
        sorted_projects = [project_bar, project_baz, project_foo]

        response = self.get_success_response(
            self.organization.slug, qs_params={"all_projects": "1", "per_page": "1"}
        )
        # Verify all projects in the org are returned in sorted order
        self.check_valid_response(response, sorted_projects)

    def test_all_projects_collapse(self):
        project_bar = self.create_project(teams=[self.team], name="bar", slug="bar")
        sorted_projects = [project_bar]

        response = self.get_success_response(
            self.organization.slug, qs_params={"all_projects": "1", "collapse": "latestDeploy"}
        )
        # Verify all projects in the org are returned in sorted order
        self.check_valid_response(response, sorted_projects)
        assert "latestDeploy" not in response.data[0]

    def test_user_projects(self):
        self.foo_user = self.create_user("foo@example.com")
        self.login_as(user=self.foo_user)

        other_team = self.create_team(organization=self.organization)

        project_bar = self.create_project(teams=[self.team], name="bar", slug="bar")
        self.create_project(teams=[other_team], name="foo", slug="foo")
        self.create_project(teams=[other_team], name="baz", slug="baz")

        # Make foo_user a part of the org and self.team
        self.create_member(organization=self.organization, user=self.foo_user, teams=[self.team])

        foo_user_projects = [project_bar]

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "is_member:1"}
        )
        # Verify projects that were returned were foo_users projects
        self.check_valid_response(response, foo_user_projects)

    def test_expand_context_options(self):
        self.project1 = self.create_project(slug="project-1", name="project 1", teams=[self.team])
        self.project2 = self.create_project(slug="project-2", name="project 2", teams=[self.team])
        self.project1.update_option("quotas:spike-protection-disabled", True)
        self.project1.update_option("sentry:token", 1)
        self.project1.update_option("sentry:random", "hi")

        response = self.get_success_response(self.organization.slug, qs_params={"options": "true"})
        assert "options" not in response.data[0]
        assert "options" not in response.data[1]

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "options": ["quotas:spike-protection-disabled", "sentry:token", "sentry:random"]
            },
        )

        assert response.data[0]["options"] == {
            "quotas:spike-protection-disabled": True,
            "sentry:token": 1,
        }
        assert not response.data[1].get("options")


class OrganizationProjectsCountTest(APITestCase):
    endpoint = "sentry-api-0-organization-projects-count"

    def setUp(self):
        super().setUp()
        self.foo_user = self.create_user("foo@example.com")
        self.login_as(user=self.foo_user)

    def test_project_count(self):
        other_team = self.create_team(organization=self.organization)

        self.create_project(teams=[self.team], name="bar", slug="bar")
        self.create_project(teams=[self.team], name="bar1", slug="bar1")
        self.create_project(teams=[self.team], name="bar2", slug="bar2")
        self.create_project(teams=[self.team], name="bar3", slug="bar3")
        self.create_project(teams=[other_team], name="foo", slug="foo")
        self.create_project(teams=[other_team], name="baz", slug="baz")

        # Make foo_user a part of the org and self.team
        self.create_member(organization=self.organization, user=self.foo_user, teams=[self.team])

        response = self.get_success_response(self.organization.slug, qs_params={"get_counts": "1"})
        assert response.data == {"allProjects": 6, "myProjects": 4}
