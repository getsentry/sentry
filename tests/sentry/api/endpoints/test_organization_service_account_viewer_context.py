from typing import Any

from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test
from sentry.viewer_context import (
    ActorType,
    ViewerContext,
    decode_viewer_context,
    encode_viewer_context,
)

FEATURE_FLAG = "organizations:service-accounts"
SECRET = "service-accounts-test-viewer-context-secret"


@cell_silo_test
@override_settings(SEER_API_SHARED_SECRET=SECRET)
class OrganizationServiceAccountViewerContextTest(APITestCase):
    endpoint = "sentry-api-0-organization-service-account-viewer-context"

    def _post(self, viewer_context: ViewerContext) -> Any:
        url = reverse(self.endpoint, args=[self.organization.slug, "7"])
        with self.feature(FEATURE_FLAG):
            return self.client.post(
                url, HTTP_X_VIEWER_CONTEXT=encode_viewer_context(viewer_context)
            )

    def test_returns_org_viewer_context(self) -> None:
        response = self._post(
            ViewerContext(organization_id=self.organization.id, actor_type=ActorType.SYSTEM)
        )

        assert response.status_code == 200
        returned = decode_viewer_context(response.data["viewerContext"])
        assert returned.organization_id == self.organization.id
        assert returned.user_id is None

    def test_rejects_viewer_context_for_other_org(self) -> None:
        other_org = self.create_organization()

        response = self._post(ViewerContext(organization_id=other_org.id))

        assert response.status_code == 403

    def test_rejects_viewer_context_with_user(self) -> None:
        response = self._post(
            ViewerContext(organization_id=self.organization.id, user_id=self.user.id)
        )

        assert response.status_code == 403

    def test_rejects_session_user(self) -> None:
        self.login_as(self.user)
        url = reverse(self.endpoint, args=[self.organization.slug, "7"])

        with self.feature(FEATURE_FLAG):
            response = self.client.post(url)

        assert response.status_code == 403

    def test_flag_off_returns_404(self) -> None:
        url = reverse(self.endpoint, args=[self.organization.slug, "7"])
        viewer_context = ViewerContext(
            organization_id=self.organization.id, actor_type=ActorType.SYSTEM
        )

        response = self.client.post(
            url, HTTP_X_VIEWER_CONTEXT=encode_viewer_context(viewer_context)
        )

        assert response.status_code == 404
