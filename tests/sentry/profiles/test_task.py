from __future__ import annotations

from os.path import join
from tempfile import TemporaryFile
from typing import Any

import pytest

from sentry.lang.javascript.processing import _handles_frame as is_valid_javascript_frame
from sentry.models.project import Project
from sentry.profiles.task import _deobfuscate, _normalize, _process_symbolicator_results_for_sample
from sentry.testutils.factories import Factories, get_fixture_path
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json

PROFILES_FIXTURES_PATH = get_fixture_path("profiles")

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


def load_profile(name):
    path = join(PROFILES_FIXTURES_PATH, name)
    with open(path) as f:
        return json.loads(f.read())


def load_proguard(project, proguard_uuid, proguard_source):
    with TemporaryFile() as tf:
        tf.write(proguard_source)
        tf.seek(0)
        file = Factories.create_file(
            name=proguard_uuid,
            type="project.dif",
            headers={"Content-Type": "proguard"},
        )
        file.putfile(tf)

    return Factories.create_dif_file(
        project,
        file=file,
        debug_id=proguard_uuid,
        object_name="proguard-mapping",
        data={"features": ["mapping"]},
    )


@pytest.fixture
def owner():
    return Factories.create_user()


@pytest.fixture
def organization(owner):
    return Factories.create_organization(owner=owner)


@pytest.fixture
def team(organization, owner):
    team = Factories.create_team(organization=organization)
    Factories.create_team_membership(team=team, user=owner)
    return team


@pytest.fixture
def project(organization, team):
    return Factories.create_project(organization=organization, teams=[team])


@pytest.fixture
def ios_profile():
    return load_profile("valid_ios_profile.json")


@pytest.fixture
def android_profile():
    return load_profile("valid_android_profile.json")


@pytest.fixture
def proguard_file_basic(project):
    return load_proguard(project, PROGUARD_UUID, PROGUARD_SOURCE)


@pytest.fixture
def proguard_file_inline(project):
    return load_proguard(project, PROGUARD_INLINE_UUID, PROGUARD_INLINE_SOURCE)


@pytest.fixture
def proguard_file_bug(project):
    return load_proguard(project, PROGUARD_BUG_UUID, PROGUARD_BUG_SOURCE)


@django_db_all
def test_normalize_ios_profile(organization, ios_profile):
    _normalize(profile=ios_profile, organization=organization)
    for k in ["device_os_build_number", "device_classification"]:
        assert k in ios_profile


@django_db_all
def test_normalize_android_profile(organization, android_profile):
    _normalize(profile=android_profile, organization=organization)
    for k in ["android_api_level", "device_classification"]:
        assert k in android_profile

    assert isinstance(android_profile["android_api_level"], int)


@django_db_all
def test_basic_deobfuscation(project, proguard_file_basic, android_profile):
    android_profile.update(
        {
            "build_id": PROGUARD_UUID,
            "project_id": project.id,
            "profile": {
                "methods": [
                    {
                        "abs_path": None,
                        "class_name": "org.a.b.g$a",
                        "name": "a",
                        "signature": "()V",
                        "source_file": None,
                        "source_line": 67,
                    },
                    {
                        "abs_path": None,
                        "class_name": "org.a.b.g$a",
                        "name": "a",
                        "signature": "()V",
                        "source_file": None,
                        "source_line": 69,
                    },
                ],
            },
        }
    )
    _deobfuscate(android_profile, project)
    frames = android_profile["profile"]["methods"]

    assert frames[0]["name"] == "getClassContext"
    assert frames[0]["class_name"] == "org.slf4j.helpers.Util$ClassContextSecurityManager"
    assert frames[1]["name"] == "getExtraClassContext"
    assert frames[1]["class_name"] == "org.slf4j.helpers.Util$ClassContextSecurityManager"


@django_db_all
def test_inline_deobfuscation(project, proguard_file_inline, android_profile):
    android_profile.update(
        {
            "build_id": PROGUARD_INLINE_UUID,
            "project_id": project.id,
            "profile": {
                "methods": [
                    {
                        "abs_path": None,
                        "class_name": "e.a.c.a",
                        "name": "onClick",
                        "signature": "()V",
                        "source_file": None,
                        "source_line": 2,
                    },
                    {
                        "abs_path": None,
                        "class_name": "io.sentry.sample.MainActivity",
                        "name": "t",
                        "signature": "()V",
                        "source_file": "MainActivity.java",
                        "source_line": 1,
                    },
                ],
            },
        }
    )

    project = Project.objects.get_from_cache(id=android_profile["project_id"])
    _deobfuscate(android_profile, project)
    frames = android_profile["profile"]["methods"]

    assert sum(len(f.get("inline_frames", [])) for f in frames) == 3

    assert frames[0]["name"] == "onClick"
    assert frames[0]["class_name"] == "io.sentry.sample.-$$Lambda$r3Avcbztes2hicEObh02jjhQqd4"

    assert frames[1]["inline_frames"][0]["name"] == "onClickHandler"
    assert frames[1]["inline_frames"][0]["source_line"] == 40
    assert frames[1]["inline_frames"][0]["source_file"] == "MainActivity.java"
    assert frames[1]["inline_frames"][0]["class_name"] == "io.sentry.sample.MainActivity"
    assert frames[1]["inline_frames"][0]["signature"] == "()"
    assert frames[1]["inline_frames"][1]["name"] == "foo"
    assert frames[1]["inline_frames"][1]["source_line"] == 44
    assert frames[1]["inline_frames"][2]["source_file"] == "MainActivity.java"
    assert frames[1]["inline_frames"][2]["class_name"] == "io.sentry.sample.MainActivity"
    assert frames[1]["inline_frames"][2]["name"] == "bar"
    assert frames[1]["inline_frames"][2]["source_line"] == 54


@django_db_all
def test_error_on_resolving(project, proguard_file_bug, android_profile):
    android_profile.update(
        {
            "build_id": PROGUARD_BUG_UUID,
            "project_id": project.id,
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

    project = Project.objects.get_from_cache(id=android_profile["project_id"])
    obfuscated_frames = android_profile["profile"]["methods"].copy()
    _deobfuscate(android_profile, project)

    assert android_profile["profile"]["methods"] == obfuscated_frames


def test_process_symbolicator_results_for_sample():
    profile: dict[str, Any] = {
        "version": 1,
        "platform": "rust",
        "profile": {
            "frames": [
                {
                    "instruction_addr": "0x55bd050e168d",
                    "lang": "rust",
                    "sym_addr": "0x55bd050e1590",
                },
                {
                    "instruction_addr": "0x89bf050e178a",
                    "lang": "rust",
                    "sym_addr": "0x95bc050e2530",
                },
                {
                    "instruction_addr": "0x88ad050d167e",
                    "lang": "rust",
                    "sym_addr": "0x29cd050a1642",
                },
            ],
            "samples": [
                {"stack_id": 0},
                # a second sample with the same stack id, the stack should
                # not be processed a second time
                {"stack_id": 0},
            ],
            "stacks": [
                [0, 1, 2],
            ],
        },
    }

    # returned from symbolicator
    stacktraces = [
        {
            "frames": [
                {
                    "instruction_addr": "0x72ba053e168c",
                    "lang": "rust",
                    "function": "C_inline_1",
                    "original_index": 0,
                },
                {
                    "instruction_addr": "0x55bd050e168d",
                    "lang": "rust",
                    "function": "C",
                    "sym_addr": "0x55bd050e1590",
                    "original_index": 0,
                },
                {
                    "instruction_addr": "0x89bf050e178a",
                    "lang": "rust",
                    "function": "B",
                    "sym_addr": "0x95bc050e2530",
                    "original_index": 1,
                },
                {
                    "instruction_addr": "0x68fd050d127b",
                    "lang": "rust",
                    "function": "A_inline_1",
                    "original_index": 2,
                },
                {
                    "instruction_addr": "0x29ce061d168a",
                    "lang": "rust",
                    "function": "A_inline_2",
                    "original_index": 2,
                },
                {
                    "instruction_addr": "0x88ad050d167e",
                    "lang": "rust",
                    "function": "A",
                    "sym_addr": "0x29cd050a1642",
                    "original_index": 2,
                },
            ],
        },
    ]

    _process_symbolicator_results_for_sample(
        profile, stacktraces, set(range(len(profile["profile"]["frames"]))), profile["platform"]
    )

    assert profile["profile"]["stacks"] == [[0, 1, 2, 3, 4, 5]]


def test_process_symbolicator_results_for_sample_js():
    profile: dict[str, Any] = {
        "version": 1,
        "platform": "javascript",
        "profile": {
            "frames": [
                {
                    "function": "functionA",
                    "abs_path": "/root/functionA.js",
                },
                {
                    "function": "functionB",
                    "abs_path": "/root/functionB.js",
                },
                {
                    "function": "functionC",
                    "abs_path": "/root/functionC.js",
                },
                # frame not valid for symbolication
                {
                    "function": "functionD",
                },
            ],
            "samples": [
                {"stack_id": 0},
                # a second sample with the same stack id, the stack should
                # not be processed a second time
                {"stack_id": 0},
            ],
            "stacks": [
                [0, 1, 2, 3],
            ],
        },
    }

    # returned from symbolicator
    stacktraces = [
        {
            "frames": [
                {
                    "function": "functionA",
                    "abs_path": "/root/functionA.js",
                    "original_index": 0,
                },
                {
                    "function": "functionB",
                    "abs_path": "/root/functionB.js",
                    "original_index": 1,
                },
                {
                    "function": "functionC",
                    "abs_path": "/root/functionC.js",
                    "original_index": 2,
                },
            ],
        },
    ]

    frames_sent = [
        idx
        for idx, frame in enumerate(profile["profile"]["frames"])
        if is_valid_javascript_frame(frame, profile)
    ]

    _process_symbolicator_results_for_sample(
        profile, stacktraces, set(frames_sent), profile["platform"]
    )

    assert profile["profile"]["stacks"] == [[0, 1, 2, 3]]


@django_db_all
def test_decode_signature(project, android_profile):
    android_profile.update(
        {
            "project_id": project.id,
            "profile": {
                "methods": [
                    {
                        "abs_path": None,
                        "class_name": "org.a.b.g$a",
                        "name": "a",
                        "signature": "()V",
                        "source_file": None,
                        "source_line": 67,
                    },
                    {
                        "abs_path": None,
                        "class_name": "org.a.b.g$a",
                        "name": "a",
                        "signature": "()Z",
                        "source_file": None,
                        "source_line": 69,
                    },
                ],
            },
        }
    )
    _deobfuscate(android_profile, project)
    frames = android_profile["profile"]["methods"]

    assert frames[0]["signature"] == "()"
    assert frames[1]["signature"] == "(): boolean"
