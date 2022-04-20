from io import BytesIO
from os import pardir
from os.path import join
from zipfile import ZipFile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from exam import fixture

from sentry.constants import MODULE_ROOT
from sentry.profiles.task import _deobfuscate, _normalize, _validate_ios_profile
from sentry.testutils import TestCase
from sentry.utils import json

PROFILES_FIXTURES_PATH = join(MODULE_ROOT, pardir, pardir, "tests", "fixtures", "profiles")

PROGUARD_UUID = "6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1"
PROGUARD_SOURCE = b"""\
# compiler: R8
# compiler_version: 2.0.74
# min_api: 16
# pg_map_id: 5b46fdc
# common_typos_disable
# {"id":"com.android.tools.r8.mapping","version":"1.0"}
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
# {"id":"com.android.tools.r8.mapping","version":"1.0"}
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


class ProfilesProcessTaskTest(TestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.create_user()
        self.organization = self.create_organization(
            owner=self.owner, flags=0  # disable default allow_joinleave access
        )
        self.team = self.create_team(organization=self.organization)
        self.upload_dsym_files_url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

        self.login_as(user=self.owner)

    @fixture
    def ios_profile(self):
        path = join(PROFILES_FIXTURES_PATH, "valid_ios_profile.json")
        with open(path) as f:
            return json.loads(f.read())

    @fixture
    def android_profile(self):
        path = join(PROFILES_FIXTURES_PATH, "valid_android_profile.json")
        with open(path) as f:
            return json.loads(f.read())

    def test_valid_ios_profile(self):
        profile = {
            "sampled_profile": {"samples": []},
        }
        self.assertEqual(_validate_ios_profile(profile), True)

    def test_invalid_ios_profile(self):
        profile = {
            "snmpled_profile": {},
        }
        self.assertEqual(_validate_ios_profile(profile), False)
        profile = {
            "sampled_profile": {"no_frames": []},
        }
        self.assertEqual(_validate_ios_profile(profile), False)

    def test_normalize_ios_profile(self):
        profile = _normalize(self.ios_profile)
        for k in ["device_os_build_number", "device_classification"]:
            assert k in profile

    def test_normalize_android_profile(self):
        profile = _normalize(self.android_profile)
        for k in ["android_api_level", "device_classification"]:
            assert k in profile

        assert isinstance(profile["android_api_level"], int)

    def test_basic_deobfuscation(self):
        out = BytesIO()
        with ZipFile(out, "w") as f:
            f.writestr(f"proguard/{PROGUARD_UUID}.txt", PROGUARD_SOURCE)

        response = self.client.post(
            self.upload_dsym_files_url,
            {
                "file": SimpleUploadedFile(
                    "symbols.zip", out.getvalue(), content_type="application/zip"
                )
            },
            format="multipart",
        )
        assert response.status_code == 201, response.content
        assert len(response.data) == 1

        profile = dict(self.android_profile)
        profile.update(
            {
                "build_id": PROGUARD_UUID,
                "project_id": self.project.id,
                "profile": {
                    "methods": [
                        {
                            "name": "a",
                            "abs_path": None,
                            "class_name": "org.a.b.g$a",
                            "source_file": None,
                            "source_line": 67,
                        },
                        {
                            "name": "a",
                            "abs_path": None,
                            "class_name": "org.a.b.g$a",
                            "source_file": None,
                            "source_line": 69,
                        },
                    ],
                },
            }
        )

        profile = _deobfuscate(profile)
        frames = profile["profile"]["methods"]

        assert frames[0]["name"] == "getClassContext"
        assert frames[0]["class_name"] == "org.slf4j.helpers.Util$ClassContextSecurityManager"
        assert frames[1]["name"] == "getExtraClassContext"
        assert frames[1]["class_name"] == "org.slf4j.helpers.Util$ClassContextSecurityManager"

    def test_inline_deobfuscation(self):
        out = BytesIO()
        with ZipFile(out, "w") as f:
            f.writestr(f"proguard/{PROGUARD_INLINE_UUID}.txt", PROGUARD_INLINE_SOURCE)

        response = self.client.post(
            self.upload_dsym_files_url,
            {
                "file": SimpleUploadedFile(
                    "symbols.zip", out.getvalue(), content_type="application/zip"
                )
            },
            format="multipart",
        )
        assert response.status_code == 201, response.content
        assert len(response.data) == 1

        profile = dict(self.android_profile)
        profile.update(
            {
                "build_id": PROGUARD_INLINE_UUID,
                "project_id": self.project.id,
                "profile": {
                    "methods": [
                        {
                            "name": "onClick",
                            "abs_path": None,
                            "class_name": "e.a.c.a",
                            "source_file": None,
                            "source_line": 2,
                        },
                        {
                            "name": "t",
                            "abs_path": None,
                            "class_name": "io.sentry.sample.MainActivity",
                            "source_file": "MainActivity.java",
                            "source_line": 1,
                        },
                    ],
                },
            }
        )

        profile = _deobfuscate(profile)
        frames = profile["profile"]["methods"]

        assert sum(len(f.get("inline_frames", [{}])) for f in frames) == 4

        assert frames[0]["name"] == "onClick"
        assert frames[0]["class_name"] == "io.sentry.sample.-$$Lambda$r3Avcbztes2hicEObh02jjhQqd4"

        assert frames[1]["inline_frames"][0]["source_file"] == "MainActivity.java"
        assert frames[1]["inline_frames"][0]["class_name"] == "io.sentry.sample.MainActivity"
        assert frames[1]["inline_frames"][0]["name"] == "bar"
        assert frames[1]["inline_frames"][0]["source_line"] == 54
        assert frames[1]["inline_frames"][1]["name"] == "foo"
        assert frames[1]["inline_frames"][1]["source_line"] == 44
        assert frames[1]["inline_frames"][2]["name"] == "onClickHandler"
        assert frames[1]["inline_frames"][2]["source_line"] == 40
        assert frames[1]["inline_frames"][2]["source_file"] == "MainActivity.java"
        assert frames[1]["inline_frames"][2]["class_name"] == "io.sentry.sample.MainActivity"

    def test_error_on_resolving(self):
        out = BytesIO()
        with ZipFile(out, "w") as f:
            f.writestr(f"proguard/{PROGUARD_BUG_UUID}.txt", PROGUARD_BUG_SOURCE)

        response = self.client.post(
            self.upload_dsym_files_url,
            {
                "file": SimpleUploadedFile(
                    "symbols.zip", out.getvalue(), content_type="application/zip"
                )
            },
            format="multipart",
        )
        assert response.status_code == 201, response.content
        assert len(response.data) == 1

        profile = dict(self.android_profile)
        profile.update(
            {
                "build_id": PROGUARD_BUG_UUID,
                "project_id": self.project.id,
                "profile": {
                    "methods": [
                        {
                            "name": "a",
                            "abs_path": None,
                            "class_name": "org.a.b.g$a",
                            "source_file": None,
                            "source_line": 67,
                        },
                        {
                            "name": "a",
                            "abs_path": None,
                            "class_name": "org.a.b.g$a",
                            "source_file": None,
                            "source_line": 69,
                        },
                    ],
                },
            }
        )

        obfuscated_frames = profile["profile"]["methods"].copy()
        profile = _deobfuscate(profile)

        assert profile["profile"]["methods"] == obfuscated_frames
