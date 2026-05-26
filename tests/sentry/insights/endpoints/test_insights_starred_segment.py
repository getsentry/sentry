from django.urls import reverse

from sentry.insights.models import InsightsStarredSegment
from sentry.testutils.cases import APITestCase, SnubaTestCase


class InsightsStarredSegmentTest(APITestCase, SnubaTestCase):
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
            "sentry-api-0-insights-starred-segments",
            kwargs={"organization_id_or_slug": self.org.slug},
        )

    def test_post_and_delete(self) -> None:
        with self.feature(self.feature_name):
            segment_name = "my_segment"

            assert not InsightsStarredSegment.objects.filter(
                segment_name=segment_name,
            ).exists()

            response = self.client.post(
                self.url, data={"segment_name": segment_name, "project_id": self.project_ids[0]}
            )
            assert response.status_code == 200, response.content

            assert InsightsStarredSegment.objects.filter(
                segment_name=segment_name,
            ).exists()

            response = self.client.delete(
                self.url, data={"segment_name": segment_name, "project_id": self.project_ids[0]}
            )
            assert response.status_code == 200, response.content

            assert not InsightsStarredSegment.objects.filter(
                segment_name=segment_name,
            ).exists()

    def test_no_error_deleting_non_existent_segment(self) -> None:
        with self.feature(self.feature_name):
            response = self.client.delete(
                self.url,
                data={"segment_name": "non_existent_segment", "project_id": self.project_ids[0]},
            )
            assert response.status_code == 200, response.content

    def test_error_creating_duplicate_segment(self) -> None:
        with self.feature(self.feature_name):
            segment_name = "my_segment"
            InsightsStarredSegment.objects.create(
                segment_name=segment_name,
                project_id=self.project_ids[0],
                organization=self.org,
                user_id=self.user.id,
            )

            response = self.client.post(
                self.url, data={"segment_name": segment_name, "project_id": self.project_ids[0]}
            )
            assert response.status_code == 403

    def test_post_rejects_project_from_other_organization(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)

        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                data={"segment_name": "my_segment", "project_id": other_project.id},
            )

            assert response.status_code == 403
            assert not InsightsStarredSegment.objects.filter(
                project_id=other_project.id,
            ).exists()

    def test_post_rejects_non_positive_project_id(self) -> None:
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                data={"segment_name": "my_segment", "project_id": 0},
            )
            assert response.status_code == 400

            response = self.client.post(
                self.url,
                data={"segment_name": "my_segment", "project_id": -1},
            )
            assert response.status_code == 400

    def test_delete_rejects_project_from_other_organization(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        InsightsStarredSegment.objects.create(
            segment_name="my_segment",
            project_id=other_project.id,
            organization=other_org,
            user_id=self.user.id,
        )

        with self.feature(self.feature_name):
            response = self.client.delete(
                self.url,
                data={"segment_name": "my_segment", "project_id": other_project.id},
            )

            assert response.status_code == 403
            assert InsightsStarredSegment.objects.filter(
                project_id=other_project.id,
            ).exists()
