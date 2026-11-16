from unittest.mock import MagicMock, patch

import orjson
from django.test.client import RequestFactory
from django.urls import reverse
from openapi_core.contrib.django import DjangoOpenAPIRequest
from openapi_core.validation.request.validators import V30RequestBodyValidator

from fixtures.apidocs_test_case import APIDocsTestCase


class ProjectPreprodSnapshotDocs(APIDocsTestCase):
    def setUp(self) -> None:
        self.url = reverse(
            "sentry-api-0-project-preprod-snapshots-create",
            args=[self.organization.slug, self.project.slug],
        )
        self.login_as(user=self.user)

    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.track_outcome")
    def test_post(self, mock_track_outcome: MagicMock) -> None:
        data = {
            "app_id": "com.example.app",
            "diff_threshold": 0.01,
            "images": {
                "home.png": {
                    "content_hash": "a1b2c3d4e5f6",
                    "display_name": "Home Screen",
                    "group": "iPhone 15",
                    "width": 1170,
                    "height": 2532,
                    "tags": ["onboarding"],
                    "canvas_theme": "dark",
                    "image_file_name": "home.png",
                },
                "settings.png": {
                    "content_hash": "f6e5d4c3b2a1",
                    "width": 1170,
                    "height": 2532,
                    "tags": {"locale": "en"},
                    "diff_threshold": None,
                },
            },
            "head_sha": "a" * 40,
            "provider": "github",
            "head_repo_name": "owner/repo",
            "head_ref": "feature/xyz",
        }
        response = self.client.post(self.url, data, format="json")
        request = RequestFactory().post(
            self.url, orjson.dumps(data), content_type="application/json"
        )

        # The endpoint accepted this body, so the documented request schema must too.
        V30RequestBodyValidator(self.cached_schema).validate(DjangoOpenAPIRequest(request))
        self.validate_schema(request, response)
