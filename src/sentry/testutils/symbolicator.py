import os
import zipfile
from io import BytesIO
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry.utils.safe import get_path

from .cases import LiveServerTestCase
from .relay import RelayStoreHelper


def strip_frame(frame):
    if frame:
        frame = {
            "data": {
                "symbolicator_status": get_path(frame, "data", "symbolicator_status"),
                "orig_in_app": get_path(frame, "data", "orig_in_app"),
            },
            "function": frame.get("function"),
            "instruction_addr": frame.get("instruction_addr"),
            "symbol": frame.get("symbol"),
            "package": frame.get("package"),
            "lineno": frame.get("lineno"),
            "in_app": frame.get("in_app"),
            "trust": frame.get("trust"),
        }

    return frame


def strip_stacktrace(stacktrace):
    if stacktrace:
        stacktrace = dict(stacktrace)
        stacktrace["frames"] = [strip_frame(x) for x in stacktrace.get("frames") or ()]

    return stacktrace


def strip_stacktrace_container(container):
    if container:
        container = dict(container)
        container["stacktrace"] = strip_stacktrace(container.get("stacktrace"))
        container["raw_stacktrace"] = strip_stacktrace(container.get("raw_stacktrace"))

    return container


@pytest.mark.snuba
@pytest.mark.usefixtures("reset_snuba")
class SymbolicatorTestCase(RelayStoreHelper, LiveServerTestCase):
    def setUp(self):
        super().setUp()

        self.project.update_option("sentry:builtin_symbol_sources", [])

        patcher = patch("sentry.auth.system.is_internal_ip", return_value=True)
        patcher.start()
        self.addCleanup(patcher.stop)

    def upload_symbols(self, fixture_path):
        url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, "w")
        f.write(fixture_path, "crash.sym")
        f.close()

        response = self.client.post(
            url,
            {
                "file": SimpleUploadedFile(
                    "symbols.zip", out.getvalue(), content_type="application/zip"
                )
            },
            format="multipart",
        )
        assert response.status_code == 201, response.content
        assert len(response.data) == 1

    def insta_snapshot_stacktrace_data(self, event, **kwargs):
        # limit amount of data going into a snapshot so that they don't break all
        # the time due to unrelated changes.
        self.insta_snapshot(
            {
                "stacktrace": strip_stacktrace(event.get("stacktrace")),
                "exception": {
                    "values": [
                        strip_stacktrace_container(x)
                        for x in get_path(event, "exception", "values") or ()
                    ]
                },
                "threads": {
                    "values": [
                        strip_stacktrace_container(x)
                        for x in get_path(event, "threads", "values") or ()
                    ]
                },
                "debug_meta": event.get("debug_meta"),
                "contexts": {
                    k: v for k, v in (event.get("contexts") or {}).items() if k != "reprocessing"
                }
                or None,
                "errors": [e for e in event.get("errors") or () if e.get("name") != "timestamp"],
            },
            **kwargs,
        )

    def get_fixture_path(self, name):
        return os.path.join(
            os.path.dirname(__file__),
            os.pardir,
            os.pardir,
            os.pardir,
            "tests",
            "fixtures",
            "native",
            name,
        )
