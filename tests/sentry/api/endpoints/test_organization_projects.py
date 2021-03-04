from base64 import b64encode

from exam import fixture

from sentry.models import ApiKey
from sentry.testutils import APITestCase


class OrganizationProjectsTest(APITestCase):
    @fixture
    def path(self):
        return f"/api/0/organizations/{self.organization.slug}/projects/"

    def check_valid_response(self, response, expected_projects):
        assert response.status_code == 200, response.content
        assert [project.id for project in expected_projects] == [
            int(project_resp["id"]) for project_resp in response.data
        ]

    def test_simple(self):
        self.login_as(user=self.user)
        project = self.create_project(teams=[self.team])

        response = self.client.get(self.path)
        self.check_valid_response(response, [project])
        assert self.client.session["activeorg"] == self.organization.slug

    def test_with_stats(self):
        self.login_as(user=self.user)

        projects = [self.create_project(teams=[self.team])]

        response = self.client.get(f"{self.path}?statsPeriod=24h", format="json")
        self.check_valid_response(response, projects)
        assert "stats" in response.data[0]

        response = self.client.get(f"{self.path}?statsPeriod=14d", format="json")
        self.check_valid_response(response, projects)
        assert "stats" in response.data[0]

        response = self.client.get(f"{self.path}?statsPeriod=", format="json")
        self.check_valid_response(response, projects)
        assert "stats" not in response.data[0]

        response = self.client.get(f"{self.path}?statsPeriod=48h", format="json")
        assert response.status_code == 400

    def test_search(self):
        self.login_as(user=self.user)
        project = self.create_project(teams=[self.team], name="bar", slug="bar")

        response = self.client.get(f"{self.path}?query=bar")
        self.check_valid_response(response, [project])

        response = self.client.get(f"{self.path}?query=baz")
        self.check_valid_response(response, [])

    def test_search_by_ids(self):
        self.login_as(user=self.user)

        project_bar = self.create_project(teams=[self.team], name="bar", slug="bar")
        project_foo = self.create_project(teams=[self.team], name="foo", slug="foo")
        self.create_project(teams=[self.team], name="baz", slug="baz")

        path = f"{self.path}?query=id:{project_foo.id}"
        response = self.client.get(path)
        self.check_valid_response(response, [project_foo])

        path = f"{self.path}?query=id:{project_bar.id} id:{project_foo.id}"
        response = self.client.get(path)

        self.check_valid_response(response, [project_bar, project_foo])

    def test_search_by_slugs(self):
        self.login_as(user=self.user)

        project_bar = self.create_project(teams=[self.team], name="bar", slug="bar")
        project_foo = self.create_project(teams=[self.team], name="foo", slug="foo")
        self.create_project(teams=[self.team], name="baz", slug="baz")

        path = f"{self.path}?query=slug:{project_foo.slug}"
        response = self.client.get(path)
        self.check_valid_response(response, [project_foo])

        path = f"{self.path}?query=slug:{project_bar.slug} slug:{project_foo.slug}"
        response = self.client.get(path)

        self.check_valid_response(response, [project_bar, project_foo])

    def test_bookmarks_appear_first_across_pages(self):
        self.login_as(user=self.user)

        projects = [
            self.create_project(teams=[self.team], name=i, slug=f"project-{i}") for i in range(3)
        ]
        projects.sort(key=lambda project: project.slug)

        response = self.client.get(self.path)
        self.check_valid_response(response, [project for project in projects])

        response = self.client.get(self.path + "?per_page=2")
        self.check_valid_response(response, [project for project in projects[:2]])

        self.create_project_bookmark(projects[-1], user=self.user)
        # Move the bookmarked project to the front
        projects.insert(0, projects.pop())
        response = self.client.get(self.path)
        self.check_valid_response(response, [project for project in projects])

        # Make sure that it's at the front when on the second page as well
        response = self.client.get(self.path + "?per_page=2")
        self.check_valid_response(response, [project for project in projects[:2]])

        # Make sure that other user's bookmarks don't interfere with this user
        other_user = self.create_user()
        self.create_project_bookmark(projects[1], user=other_user)
        response = self.client.get(self.path)
        self.check_valid_response(response, [project for project in projects])

    def test_team_filter(self):
        self.login_as(user=self.user)
        other_team = self.create_team(organization=self.organization)

        project_bar = self.create_project(teams=[self.team], name="bar", slug="bar")
        project_foo = self.create_project(teams=[other_team], name="foo", slug="foo")
        project_baz = self.create_project(teams=[other_team], name="baz", slug="baz")
        path = f"{self.path}?query=team:{self.team.slug}"
        response = self.client.get(path)
        self.check_valid_response(response, [project_bar])

        path = f"{self.path}?query=!team:{self.team.slug}"
        response = self.client.get(path)
        self.check_valid_response(response, [project_baz, project_foo])

    def test_api_key(self):
        key = ApiKey.objects.create(organization=self.organization, scope_list=["org:read"])

        project = self.create_project(teams=[self.team])

        response = self.client.get(
            self.path,
            HTTP_AUTHORIZATION=b"Basic " + b64encode(f"{key.key}:".encode("utf-8")),
        )
        self.check_valid_response(response, [project])

    def test_all_projects(self):
        self.login_as(user=self.user)
        other_team = self.create_team(organization=self.organization)

        project_bar = self.create_project(teams=[self.team], name="bar", slug="bar")
        project_foo = self.create_project(teams=[other_team], name="foo", slug="foo")
        project_baz = self.create_project(teams=[other_team], name="baz", slug="baz")
        sorted_projects = [project_bar, project_baz, project_foo]

        response = self.client.get(self.path + "?all_projects=1&per_page=1")
        # Verify all projects in the org are returned in sorted order
        self.check_valid_response(response, sorted_projects)

    def test_all_projects_collapse(self):
        self.login_as(user=self.user)
        project_bar = self.create_project(teams=[self.team], name="bar", slug="bar")
        sorted_projects = [project_bar]

        response = self.client.get(self.path + "?all_projects=1&collapse=latestDeploy")
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

        response = self.client.get(self.path + "?query=is_member:1")
        # Verify projects that were returned were foo_users projects
        self.check_valid_response(response, foo_user_projects)


class OrganizationProjectsCountTest(APITestCase):
    @fixture
    def path(self):
        return f"/api/0/organizations/{self.organization.slug}/projects-count/"

    def test_project_count(self):
        self.foo_user = self.create_user("foo@example.com")
        self.login_as(user=self.foo_user)

        other_team = self.create_team(organization=self.organization)

        self.create_project(teams=[self.team], name="bar", slug="bar")
        self.create_project(teams=[self.team], name="bar1", slug="bar1")
        self.create_project(teams=[self.team], name="bar2", slug="bar2")
        self.create_project(teams=[self.team], name="bar3", slug="bar3")
        self.create_project(teams=[other_team], name="foo", slug="foo")
        self.create_project(teams=[other_team], name="baz", slug="baz")

        # Make foo_user a part of the org and self.team
        self.create_member(organization=self.organization, user=self.foo_user, teams=[self.team])

        response = self.client.get(self.path + "?get_counts=1")
        assert response.status_code == 200, response.content
        assert response.data == {"allProjects": 6, "myProjects": 4}
