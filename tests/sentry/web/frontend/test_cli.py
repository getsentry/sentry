from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class GetCliDownloadUrlTestCase(TestCase):
    def test_cli(self) -> None:
        resp = self.client.get(reverse("get_cli_script"), HTTP_ACCEPT="text/markdown")
        assert resp.status_code == 200
        assert resp.content.startswith(b"#!/bin/sh\n")
        assert b"https://cli.sentry.dev/install" in resp.content
        # Pinned v3 installs still download sentry-cli from the release registry.
        assert b"https://release-registry.services.sentry.io/apps/sentry-cli" in resp.content

    def test_valid_platform_arch(self) -> None:
        resp = self.client.get(
            reverse("get_cli_download_url", args=("Linux", "x86_64")), HTTP_ACCEPT="text/markdown"
        )

        assert resp.status_code == 302
        assert (
            resp["Location"]
            == "https://release-registry.services.sentry.io/apps/sentry/latest?response=download&arch=x64&platform=linux&package=sentry"
        )

    def test_v4_platform_arch_names(self) -> None:
        resp = self.client.get(reverse("get_cli_download_url", args=("darwin", "arm64")))

        assert resp.status_code == 302
        assert (
            resp["Location"]
            == "https://release-registry.services.sentry.io/apps/sentry/latest?response=download&arch=arm64&platform=darwin&package=sentry"
        )

    def test_platform_without_v4_build(self) -> None:
        resp = self.client.get(reverse("get_cli_download_url", args=("Linux", "i686")))

        assert resp.status_code == 302
        assert (
            resp["Location"]
            == "https://release-registry.services.sentry.io/apps/sentry-cli/3.8.2?response=download&arch=i686&platform=Linux&package=sentry-cli"
        )
