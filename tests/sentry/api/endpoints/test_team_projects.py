from sentry.ingest import inbound_filters
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.types import FallthroughChoiceType
from sentry.slug.errors import DEFAULT_SLUG_ERROR_MESSAGE
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test
class TeamProjectsListTest(APITestCase):
    endpoint = "sentry-api-0-team-project-index"
    method = "get"

    def setUp(self):
        super().setUp()
        self.team = self.create_team(members=[self.user])
        self.proj1 = self.create_project(teams=[self.team])
        self.proj2 = self.create_project(teams=[self.team])
        self.login_as(user=self.user)

    def test_simple(self):
        response = self.get_success_response(
            self.organization.slug, self.team.slug, status_code=200
        )
        project_ids = {item["id"] for item in response.data}

        assert len(response.data) == 2
        assert project_ids == {str(self.proj1.id), str(self.proj2.id)}

    def test_excludes_project(self):
        proj3 = self.create_project()
        response = self.get_success_response(
            self.organization.slug, self.team.slug, status_code=200
        )

        assert str(proj3.id) not in response.data


@region_silo_test
class TeamProjectsCreateTest(APITestCase):
    endpoint = "sentry-api-0-team-project-index"
    method = "post"

    def setUp(self):
        super().setUp()
        self.team = self.create_team(members=[self.user])
        self.data = {"name": "foo", "slug": "bar", "platform": "python"}
        self.login_as(user=self.user)

    def test_simple(self):
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            status_code=201,
        )

        # fetch from db to check project's team
        project = Project.objects.get(id=response.data["id"])
        assert project.name == "foo"
        assert project.slug == "bar"
        assert project.platform == "python"
        assert project.teams.first() == self.team

    def test_invalid_numeric_slug(self):
        response = self.get_error_response(
            self.organization.slug,
            self.team.slug,
            name="fake name",
            slug="12345",
            status_code=400,
        )

        assert response.data["slug"][0] == DEFAULT_SLUG_ERROR_MESSAGE

    def test_generated_slug_not_entirely_numeric(self):
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            name="1234",
            status_code=201,
        )
        slug = response.data["slug"]
        assert slug.startswith("1234-")
        assert not slug.isdecimal()

    def test_invalid_platform(self):
        response = self.get_error_response(
            self.organization.slug,
            self.team.slug,
            name="fake name",
            platform="fake platform",
            status_code=400,
        )
        assert response.data["platform"][0] == "Invalid platform"

    def test_duplicate_slug(self):
        self.create_project(slug="bar")
        response = self.get_error_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            status_code=409,
        )
        assert response.data["detail"] == "A project with this slug already exists."

    def test_default_rules(self):
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            default_rules=True,
            status_code=201,
        )

        project = Project.objects.get(id=response.data["id"])
        rule = Rule.objects.filter(project=project).first()
        assert (
            rule.data["actions"][0]["fallthroughType"] == FallthroughChoiceType.ACTIVE_MEMBERS.value
        )

    def test_without_default_rules(self):
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            default_rules=False,
            status_code=201,
        )
        project = Project.objects.get(id=response.data["id"])
        assert not Rule.objects.filter(project=project).exists()

    def test_default_inbound_filters(self):
        filters = ["browser-extensions", "legacy-browsers", "web-crawlers", "filtered-transaction"]
        python_response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **self.data,
            status_code=201,
        )

        python_project = Project.objects.get(id=python_response.data["id"])

        python_filter_states = {
            filter_id: inbound_filters.get_filter_state(filter_id, python_project)
            for filter_id in filters
        }

        assert not python_filter_states["browser-extensions"]
        assert not python_filter_states["legacy-browsers"]
        assert not python_filter_states["web-crawlers"]
        assert python_filter_states["filtered-transaction"]

        project_data = {"name": "foo", "slug": "baz", "platform": "javascript-react"}
        javascript_response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **project_data,
            status_code=201,
        )

        javascript_project = Project.objects.get(id=javascript_response.data["id"])

        javascript_filter_states = {
            filter_id: inbound_filters.get_filter_state(filter_id, javascript_project)
            for filter_id in filters
        }

        assert javascript_filter_states["browser-extensions"]
        assert set(javascript_filter_states["legacy-browsers"]) == {
            "ie_pre_9",
            "ie9",
            "ie10",
            "ie11",
            "safari_pre_6",
            "opera_pre_15",
            "opera_mini_pre_8",
            "android_pre_4",
            "edge_pre_79",
        }
        assert javascript_filter_states["web-crawlers"]
        assert javascript_filter_states["filtered-transaction"]

    @with_feature("organizations:legacy-browser-update")
    def test_updated_legacy_browser_default(self):
        project_data = {"name": "foo", "slug": "baz", "platform": "javascript-react"}
        javascript_response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            **project_data,
            status_code=201,
        )

        javascript_project = Project.objects.get(id=javascript_response.data["id"])

        assert set(inbound_filters.get_filter_state("legacy-browsers", javascript_project)) == {
            "ie",
            "firefox",
            "chrome",
            "safari",
            "opera",
            "opera_mini",
            "android",
            "edge",
        }
