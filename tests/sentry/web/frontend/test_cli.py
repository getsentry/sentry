import os
import subprocess
import tempfile
from pathlib import Path

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

    def _first_download(self, sentry_cli_version: str) -> str:
        """Run the get-cli script with a fake curl and return the first URL it fetches."""
        script = self.client.get(reverse("get_cli_script")).content
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "get-cli.sh").write_bytes(script)
            # The fake curl records its arguments and fails, so the script stops there.
            curl = tmp_path / "curl"
            curl.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$CURL_LOG"\nexit 22\n')
            curl.chmod(0o755)
            log = tmp_path / "curl.log"
            subprocess.run(
                ["sh", str(tmp_path / "get-cli.sh")],
                env={
                    "PATH": f"{tmp}:{os.environ['PATH']}",
                    "HOME": tmp,
                    "TMPDIR": tmp,
                    "CURL_LOG": str(log),
                    "SENTRY_CLI_VERSION": sentry_cli_version,
                    "INSTALL_DIR": str(tmp_path / "bin"),
                },
                capture_output=True,
                check=False,
            )
            return log.read_text().splitlines()[0]

    def test_cli_legacy_versions(self) -> None:
        for version in ("3", "v3", "2", "3.8.2", "v2.42.1"):
            download = self._first_download(version)
            expected = f"https://release-registry.services.sentry.io/apps/sentry-cli/{version.removeprefix('v')}?"
            assert expected in download, version

    def test_cli_v4_versions(self) -> None:
        for version in ("latest", "4", "4.0.0", "v4.1.0", "nightly"):
            download = self._first_download(version)
            assert "https://cli.sentry.dev/install" in download, version

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
