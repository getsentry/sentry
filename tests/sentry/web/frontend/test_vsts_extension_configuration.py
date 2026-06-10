from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class VstsExtensionConfigureRedirectTest(TestCase):
    @property
    def path(self) -> str:
        return reverse("vsts-extension-configuration")

    def test_forwards_marketplace_params_to_link(self) -> None:
        resp = self.client.get(self.path, {"targetId": "1", "targetName": "foo"})

        assert resp.status_code == 302
        location = resp.headers["Location"]
        assert location.startswith("/extensions/vsts/link/")
        assert "targetId=1" in location
        assert "targetName=foo" in location
