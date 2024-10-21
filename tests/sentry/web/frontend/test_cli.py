from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class GetCliDownloadUrlTestCase(TestCase):
    def test_cli(self) -> None:
        resp = self.client.get(reverse("get_cli_script"))
        assert b"https://release-registry.services.sentry.io/apps/sentry-cli" in resp.content

    def test_valid_platform_arch(self) -> None:
        resp = self.client.get(reverse("get_cli_download_url", args=("Linux", "x86_64")))

        assert resp.status_code == 302
        assert (
            resp["Location"]
            == "https://release-registry.services.sentry.io/apps/sentry-cli/latest?response=download&arch=x86_64&platform=Linux&package=sentry-cli"
        )
