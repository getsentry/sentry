from urllib.parse import urlencode

from django.urls import reverse

from sentry.insights.models import InsightsStarredSegment
from sentry.testutils.cases import APITestCase, SnubaTestCase


class OrganizationStarredServiceSpansTest(APITestCase, SnubaTestCase):
    feature_name = "organizations:insights-modules-use-eap"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project_ids = [
            self.create_project(organization=self.org).id,
            self.create_project(organization=self.org).id,
        ]

        self.url = reverse(
            "sentry-api-0-organization-starred-service-spans",
            kwargs={"organization_id_or_slug": self.org.slug},
        )

    def delete_url(self, service_span: str, project_id: int) -> str:
        return f"{self.url}?{urlencode({'service_span': service_span, 'project_id': project_id})}"

    def test_post_and_delete(self) -> None:
        with self.feature(self.feature_name):
            service_span = "my_service_span"

            assert not InsightsStarredSegment.objects.filter(
                segment_name=service_span,
            ).exists()

            response = self.client.post(
                self.url, data={"service_span": service_span, "project_id": self.project_ids[0]}
            )
            assert response.status_code == 200, response.content

            assert InsightsStarredSegment.objects.filter(
                segment_name=service_span,
            ).exists()

            response = self.client.delete(self.delete_url(service_span, self.project_ids[0]))
            assert response.status_code == 200, response.content

            assert not InsightsStarredSegment.objects.filter(
                segment_name=service_span,
            ).exists()

    def test_no_error_deleting_non_existent_service_span(self) -> None:
        with self.feature(self.feature_name):
            response = self.client.delete(self.delete_url("non_existent", self.project_ids[0]))
            assert response.status_code == 200, response.content

    def test_error_creating_duplicate_service_span(self) -> None:
        with self.feature(self.feature_name):
            service_span = "my_service_span"
            InsightsStarredSegment.objects.create(
                segment_name=service_span,
                project_id=self.project_ids[0],
                organization=self.org,
                user_id=self.user.id,
            )

            response = self.client.post(
                self.url, data={"service_span": service_span, "project_id": self.project_ids[0]}
            )
            assert response.status_code == 403

    def test_post_rejects_project_from_other_organization(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)

        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                data={"service_span": "my_service_span", "project_id": other_project.id},
            )

            assert response.status_code == 403
            assert not InsightsStarredSegment.objects.filter(
                project_id=other_project.id,
            ).exists()

    def test_post_rejects_non_positive_project_id(self) -> None:
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                data={"service_span": "my_service_span", "project_id": 0},
            )
            assert response.status_code == 400

            response = self.client.post(
                self.url,
                data={"service_span": "my_service_span", "project_id": -1},
            )
            assert response.status_code == 400

    def test_post_rejects_segment_name(self) -> None:
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                data={"segment_name": "my_service_span", "project_id": self.project_ids[0]},
            )
            assert response.status_code == 400

    def test_delete_rejects_project_from_other_organization(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        InsightsStarredSegment.objects.create(
            segment_name="my_service_span",
            project_id=other_project.id,
            organization=other_org,
            user_id=self.user.id,
        )

        with self.feature(self.feature_name):
            response = self.client.delete(self.delete_url("my_service_span", other_project.id))

            assert response.status_code == 403
            assert InsightsStarredSegment.objects.filter(
                project_id=other_project.id,
            ).exists()

    def test_delete_ignores_body(self) -> None:
        with self.feature(self.feature_name):
            response = self.client.delete(
                self.url,
                data={"service_span": "my_service_span", "project_id": self.project_ids[0]},
            )
            assert response.status_code == 400

    def test_delete_without_params(self) -> None:
        with self.feature(self.feature_name):
            response = self.client.delete(self.url)
            assert response.status_code == 400
