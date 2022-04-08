import zipfile
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry.testutils import RelayStoreHelper, TransactionTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format

PROGUARD_UUID = "6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1"
PROGUARD_SOURCE = b"""\
org.slf4j.helpers.Util$ClassContextSecurityManager -> org.a.b.g$a:
    65:65:void <init>() -> <init>
    67:67:java.lang.Class[] getClassContext() -> a
    69:69:java.lang.Class[] getExtraClassContext() -> a
    65:65:void <init>(org.slf4j.helpers.Util$1) -> <init>
"""
PROGUARD_INLINE_UUID = "d748e578-b3d1-5be5-b0e5-a42e8c9bf8e0"
PROGUARD_INLINE_SOURCE = b"""\
# compiler: R8
# compiler_version: 2.0.74
# min_api: 16
# pg_map_id: 5b46fdc
# common_typos_disable
$r8$backportedMethods$utility$Objects$2$equals -> a:
    boolean equals(java.lang.Object,java.lang.Object) -> a
$r8$twr$utility -> b:
    void $closeResource(java.lang.Throwable,java.lang.Object) -> a
android.support.v4.app.RemoteActionCompatParcelizer -> android.support.v4.app.RemoteActionCompatParcelizer:
    1:1:void <init>():11:11 -> <init>
io.sentry.sample.-$$Lambda$r3Avcbztes2hicEObh02jjhQqd4 -> e.a.c.a:
    io.sentry.sample.MainActivity f$0 -> b
io.sentry.sample.MainActivity -> io.sentry.sample.MainActivity:
    1:1:void <init>():15:15 -> <init>
    1:1:boolean onCreateOptionsMenu(android.view.Menu):60:60 -> onCreateOptionsMenu
    1:1:boolean onOptionsItemSelected(android.view.MenuItem):69:69 -> onOptionsItemSelected
    2:2:boolean onOptionsItemSelected(android.view.MenuItem):76:76 -> onOptionsItemSelected
    1:1:void bar():54:54 -> t
    1:1:void foo():44 -> t
    1:1:void onClickHandler(android.view.View):40 -> t
"""
PROGUARD_BUG_UUID = "071207ac-b491-4a74-957c-2c94fd9594f2"
PROGUARD_BUG_SOURCE = b"x"


class BasicResolvingIntegrationTest(RelayStoreHelper, TransactionTestCase):
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
                        "value": "Oh no",
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

    def test_resolving_inline(self):
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
        f.writestr("proguard/%s.txt" % PROGUARD_INLINE_UUID, PROGUARD_INLINE_SOURCE)
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
            "debug_meta": {"images": [{"type": "proguard", "uuid": PROGUARD_INLINE_UUID}]},
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "onClick",
                                    "abs_path": None,
                                    "module": "e.a.c.a",
                                    "filename": None,
                                    "lineno": 2,
                                },
                                {
                                    "function": "t",
                                    "abs_path": None,
                                    "module": "io.sentry.sample.MainActivity",
                                    "filename": "MainActivity.java",
                                    "lineno": 1,
                                },
                            ]
                        },
                        "module": "org.a.b",
                        "type": "g$a",
                        "value": "Oh no",
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

        assert len(frames) == 4

        assert frames[0].function == "onClick"
        assert frames[0].module == "io.sentry.sample.-$$Lambda$r3Avcbztes2hicEObh02jjhQqd4"

        assert frames[1].filename == "MainActivity.java"
        assert frames[1].module == "io.sentry.sample.MainActivity"
        assert frames[1].function == "onClickHandler"
        assert frames[1].lineno == 40
        assert frames[2].function == "foo"
        assert frames[2].lineno == 44
        assert frames[3].function == "bar"
        assert frames[3].lineno == 54
        assert frames[3].filename == "MainActivity.java"
        assert frames[3].module == "io.sentry.sample.MainActivity"

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
                        "value": "Oh no",
                    }
                ]
            },
            "timestamp": iso_format(before_now(seconds=1)),
        }

        event = self.post_and_retrieve_event(event_data)

        assert len(event.data["errors"]) == 1
        assert event.data["errors"][0] == {
            "mapping_uuid": "071207ac-b491-4a74-957c-2c94fd9594f2",
            "type": "proguard_missing_lineno",
        }
