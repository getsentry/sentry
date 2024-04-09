from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.web.frontend.generic import FOREVER_CACHE


@control_silo_test
class DocIntegrationAvatartest(APITestCase):
    endpoint = "sentry-doc-integration-avatar-url"

    def test_headers(self):
        doc = self.create_doc_integration(name="spiderman", has_avatar=True)
        url = reverse(self.endpoint, args=[doc.avatar.get().ident])
        response = self.client.get(url)

        assert response.status_code == 200
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response.get("Vary") == "Accept-Language, Cookie"
        assert response.get("Set-Cookie") is None
