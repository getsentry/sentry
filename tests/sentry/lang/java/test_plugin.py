from __future__ import absolute_import

import zipfile
import pytest
from six import BytesIO

from django.core.urlresolvers import reverse
from django.core.files.uploadedfile import SimpleUploadedFile

from sentry.testutils import SentryStoreHelper, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format

PROGUARD_UUID = "6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1"
PROGUARD_SOURCE = b"""\
org.slf4j.helpers.Util$ClassContextSecurityManager -> org.a.b.g$a:
    65:65:void <init>() -> <init>
    67:67:java.lang.Class[] getClassContext() -> a
    69:69:java.lang.Class[] getExtraClassContext() -> a
    65:65:void <init>(org.slf4j.helpers.Util$1) -> <init>
"""
PROGUARD_BUG_UUID = "071207ac-b491-4a74-957c-2c94fd9594f2"
PROGUARD_BUG_SOURCE = b"x"


class BasicResolvingIntegrationTest(object):
    def post_and_retrieve_event(self, data):
        raise NotImplementedError(
            "post_and_retrieve_event should be implemented in a dervied test class"
        )

    def test_basic_resolving(self):
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
        f.writestr("proguard/%s.txt" % PROGUARD_UUID, PROGUARD_SOURCE)
        f.writestr("ignored-file.txt", b"This is just some stuff")
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

        event_data = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {"images": [{"type": "proguard", "uuid": PROGUARD_UUID}]},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 67,
                                },
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 69,
                                },
                            ]
                        },
                        "module": "org.a.b",
                        "type": "g$a",
                        "value": "Shit broke yo",
                    }
                ]
            },
            "timestamp": iso_format(before_now(seconds=1)),
        }

        event = self.post_and_retrieve_event(event_data)
        if not self.use_relay():
            # We measure the number of queries after an initial post,
            # because there are many queries polluting the array
            # before the actual "processing" happens (like, auth_user)
            with self.assertWriteQueries(
                {
                    "nodestore_node": 2,
                    "sentry_eventuser": 1,
                    "sentry_groupedmessage": 1,
                    "sentry_userreport": 1,
                }
            ):
                self.post_and_retrieve_event(event_data)

        exc = event.interfaces["exception"].values[0]
        bt = exc.stacktrace
        frames = bt.frames

        assert exc.type == "Util$ClassContextSecurityManager"
        assert exc.module == "org.slf4j.helpers"
        assert frames[0].function == "getClassContext"
        assert frames[0].module == "org.slf4j.helpers.Util$ClassContextSecurityManager"
        assert frames[1].function == "getExtraClassContext"
        assert frames[1].module == "org.slf4j.helpers.Util$ClassContextSecurityManager"

        assert event.culprit == (
            "org.slf4j.helpers.Util$ClassContextSecurityManager " "in getExtraClassContext"
        )

    def test_error_on_resolving(self):
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
        f.writestr("proguard/%s.txt" % PROGUARD_BUG_UUID, PROGUARD_BUG_SOURCE)
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

        event_data = {
            "user": {"ip_address": "31.172.207.97"},
            "extra": {},
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {"images": [{"type": "proguard", "uuid": PROGUARD_BUG_UUID}]},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 67,
                                },
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 69,
                                },
                            ]
                        },
                        "type": "RuntimeException",
                        "value": "Shit broke yo",
                    }
                ]
            },
            "timestamp": iso_format(before_now(seconds=1)),
        }

        event = self.post_and_retrieve_event(event_data)

        assert len(event.data["errors"]) == 1
        assert event.data["errors"][0] == {
            "mapping_uuid": u"071207ac-b491-4a74-957c-2c94fd9594f2",
            "type": "proguard_missing_lineno",
        }


@pytest.mark.sentry_store_integration
class BasicResolvingIntegrationTestLegacy(
    SentryStoreHelper, TestCase, BasicResolvingIntegrationTest
):
    pass
