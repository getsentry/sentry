from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode


class ProjectMetricsExtractionEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-metrics-extraction-rules"

    def setUp(self):
        self.login_as(user=self.user)

    @with_feature("organizations:custom-metrics-extraction-rule")
    def send_put_request(self, token, endpoint):
        url = reverse(endpoint, args=[self.organization.slug])
        return self.client.put(url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json")

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_permissions(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=[])

        response = self.send_put_request(token, self.endpoint)
        assert response.status_code == 403

        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["org:write"])

        response = self.send_put_request(token, self.endpoint)
        assert response.status_code != 403

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_permissions_prevent_accessing_projects_in_other_org(self):
        other_org = self.create_organization()
        other_user = self.create_user()
        config = {
            "spanAttribute": "count_clicks",
            "aggregates": ["count", "p50", "p75", "p95", "p99"],
            "unit": "none",
            "tags": ["tag1", "tag2"],
            "conditions": [
                {"value": "foo:bar"},
            ],
        }
        project = self.create_project(organization=other_org, name="other project")
        self.create_span_attribute_extraction_config(
            dictionary=config, user_id=other_user.id, project=project
        )
        response = self.get_response(self.organization.slug, method="get", project=[project.id])
        assert response.status_code == 403

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_single_project(self):
        projects = []

        for i in range(0, 3):
            config = {
                "spanAttribute": f"count_clicks_{i}",
                "aggregates": ["count", "p50", "p75", "p95", "p99"],
                "unit": "none",
                "tags": [f"tag{num}" for num in range(0, i)],
                "conditions": [
                    {"value": f"foo:bar{i}"},
                ],
            }
            project = self.create_project(organization=self.organization, name=f"project_{i}")
            projects.append(project)
            self.create_span_attribute_extraction_config(
                dictionary=config, user_id=self.user.id, project=project
            )
        response = self.get_response(self.organization.slug, method="get", project=[projects[0].id])
        assert response.status_code == 200
        data = response.data
        assert len(data) == 1
        assert [el["projectId"] for el in data] == [projects[0].id]

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_multiple_projects_with_multiple_rules(self):
        projects = []

        for i in range(0, 3):
            configs = [
                {
                    "spanAttribute": f"count_clicks_{i}",
                    "aggregates": ["count", "p50", "p75", "p95", "p99"],
                    "unit": "none",
                    "tags": [f"tag{num}" for num in range(0, i)],
                    "conditions": [
                        {"value": f"foo:bar{i}"},
                    ],
                },
                {
                    "spanAttribute": f"another_span_{i}",
                    "aggregates": ["avg", "min", "max", "sum"],
                    "unit": "none",
                    "tags": [f"tag{num*2}" for num in range(0, i)],
                    "conditions": [
                        {"value": f"foo:bar{i}"},
                    ],
                },
            ]
            project = self.create_project(organization=self.organization, name=f"project_{i}")
            projects.append(project)
            for config in configs:
                self.create_span_attribute_extraction_config(
                    dictionary=config, user_id=self.user.id, project=project
                )
        response = self.get_response(
            self.organization.slug, method="get", project=[p.id for p in projects[0:2]]
        )
        assert response.status_code == 200
        data = response.data
        assert len(data) == 4
        assert {el["projectId"] for el in data} == {p.id for p in projects[0:2]}

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_multiple_projects_with_and_without_rules(self):
        projects = [self.create_project(organization=self.organization, name="empty project")]

        for i in range(0, 3):
            configs = [
                {
                    "spanAttribute": f"count_clicks_{i}",
                    "aggregates": ["count", "p50", "p75", "p95", "p99"],
                    "unit": "none",
                    "tags": [f"tag{num}" for num in range(0, i)],
                    "conditions": [
                        {"value": f"foo:bar{i}"},
                    ],
                },
                {
                    "spanAttribute": f"another_span_{i}",
                    "aggregates": ["avg", "min", "max", "sum"],
                    "unit": "none",
                    "tags": [f"tag{num*2}" for num in range(0, i)],
                    "conditions": [
                        {"value": f"foo:bar{i}"},
                    ],
                },
            ]
            project = self.create_project(organization=self.organization, name=f"project_{i}")
            projects.append(project)
            for config in configs:
                self.create_span_attribute_extraction_config(
                    dictionary=config, user_id=self.user.id, project=project
                )
        response = self.get_response(
            self.organization.slug, method="get", project=[p.id for p in projects[0:3]]
        )
        assert response.status_code == 200
        data = response.data
        assert len(data) == 4
        assert {el["projectId"] for el in data} == {p.id for p in projects[1:3]}

    @django_db_all
    def test_option_hides_endpoint(self):
        response = self.get_response(
            self.organization.slug,
            method="get",
        )
        assert response.status_code == 404

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_query_filter_rules(self):
        projects = []
        for i, span_attribute in zip(range(0, 3), ("count_clicks", "some_span", "count_views")):
            project = self.create_project(organization=self.organization, name=f"project_{i}")
            projects.append(project)
            self.create_span_attribute_extraction_config(
                dictionary={
                    "spanAttribute": span_attribute,
                    "aggregates": ["count", "p50", "p75", "p95", "p99"],
                    "unit": "none",
                    "tags": [f"tag{num}" for num in range(0, i)],
                    "conditions": [
                        {"value": f"foo:bar{i}"},
                    ],
                },
                user_id=self.user.id,
                project=project,
            )

        response = self.get_response(
            self.organization.slug,
            method="get",
            query="count",
            project=[p.id for p in projects],
        )

        assert response.status_code == 200
        data = response.data
        assert len(data) == 2
        assert {el["spanAttribute"] for el in data} == {"count_clicks", "count_views"}

        response = self.get_response(
            self.organization.slug,
            method="get",
            query="span",
            project=[p.id for p in projects],
        )

        assert response.status_code == 200
        data = response.data
        assert len(data) == 1
        assert {el["spanAttribute"] for el in data} == {"some_span"}
