from rest_framework import status

from sentry.testutils.cases import APITestCase
from sentry.web.frontend.generic import FOREVER_CACHE


class DocIntegrationAvatartest(APITestCase):
    endpoint = "sentry-doc-integration-avatar-url"

    def test_headers(self):
        doc = self.create_doc_integration(name="spiderman", has_avatar=True)
        response = self.get_success_response(doc.avatar.get().ident, status_code=status.HTTP_200_OK)
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response.get("Vary") == "Accept-Language, Cookie"
        assert response.get("Set-Cookie") is None
