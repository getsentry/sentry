from typing import Any

import pytest
from symbolic.proguard import ProguardMapper

from sentry.lang.java.proguard import open_proguard_mapper
from sentry.profiles.java import (
    _apply_jvm_frame_to_sample_v2_frame,
    convert_android_methods_to_jvm_frames,
    deobfuscate_signature,
    format_signature,
    merge_jvm_frames_with_android_methods,
)

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


@pytest.fixture
def mapper(tmp_path):
    mapping_file_path = str(tmp_path.joinpath("mapping_file"))
    with open(mapping_file_path, "wb") as f:
        f.write(PROGUARD_SOURCE)
    mapper = open_proguard_mapper(mapping_file_path)
    assert mapper.has_line_info
    return mapper


@pytest.mark.parametrize(
    ["obfuscated", "expected"],
    [
        # invalid signatures
        ("", ""),
        ("()", ""),
        ("(L)", ""),
        # valid signatures
        ("()V", "()"),
        ("([I)V", "(int[])"),
        ("(III)V", "(int, int, int)"),
        ("([Ljava/lang/String;)V", "(java.lang.String[])"),
        ("([[J)V", "(long[][])"),
        ("(I)I", "(int): int"),
        ("([B)V", "(byte[])"),
        (
            "(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;",
            "(java.lang.String, java.lang.String): java.lang.String",
        ),
    ],
)
def test_deobfuscate_signature(mapper: ProguardMapper, obfuscated: str, expected: str) -> None:
    types = deobfuscate_signature(obfuscated, mapper)
    assert format_signature(types) == expected


def test_convert_android_methods_to_jvm_frames_trace_format() -> None:
    profile: dict[str, Any] = {
        "version": "2.android-trace",
        "platform": "android",
        "profile": {
            "methods": [
                {
                    "name": "onCreate",
                    "class_name": "com.example.MainActivity",
                    "signature": "()V",
                    "source_line": 42,
                    "source_file": "MainActivity.java",
                },
                # only the required fields are present here
                {"name": "run", "class_name": "java.lang.Thread"},
            ],
        },
    }

    assert convert_android_methods_to_jvm_frames(profile) == [
        {
            "function": "onCreate",
            "index": 0,
            "module": "com.example.MainActivity",
            "signature": "()V",
            "lineno": 42,
            "filename": "MainActivity.java",
        },
        {"function": "run", "index": 1, "module": "java.lang.Thread"},
    ]


def test_convert_android_methods_to_jvm_frames_sample_v2_filters_non_jvm() -> None:
    # sample v2 keeps only JVM frames but preserves their original index so
    # the deobfuscated results can be merged back.
    profile: dict[str, Any] = {
        "version": "2",
        "platform": "android",
        "profile": {
            "frames": [
                {"function": "a", "module": "com.example.A", "platform": "java"},
                {"function": "native_fn", "platform": "native"},
                {
                    "function": "b",
                    "module": "com.example.B",
                    "signature": "()V",
                    "lineno": 7,
                    "filename": "B.java",
                    "platform": "android",
                },
                # function and module are optional on sample format frames;
                # such frames are kept so the other field is still deobfuscated
                {"module": "com.example.C", "platform": "java"},
            ],
        },
    }

    assert convert_android_methods_to_jvm_frames(profile) == [
        {"function": "a", "index": 0, "module": "com.example.A"},
        {
            "function": "b",
            "index": 2,
            "module": "com.example.B",
            "signature": "()V",
            "lineno": 7,
            "filename": "B.java",
        },
        {"function": "", "index": 3, "module": "com.example.C"},
    ]


def test_apply_jvm_frame_to_sample_v2_frame() -> None:
    frame: dict[str, Any] = {"function": "orig", "module": "obf", "platform": "java"}
    _apply_jvm_frame_to_sample_v2_frame(
        {
            "function": "deobf",
            "module": "com.example.Foo",
            "signature": "()",
            "filename": "Foo.java",
            "lineno": 12,
            "in_app": True,
        },
        frame,
    )
    assert frame == {
        "function": "deobf",
        "module": "com.example.Foo",
        "platform": "java",
        "data": {"deobfuscation_status": "deobfuscated"},
        "signature": "()",
        "filename": "Foo.java",
        "lineno": 12,
        "in_app": True,
    }


def test_apply_jvm_frame_to_sample_v2_frame_skips_zero_lineno_and_missing_fields() -> None:
    frame: dict[str, Any] = {"function": "orig", "module": "obf", "lineno": 99}
    # lineno == 0 must not overwrite; optional fields absent from the source
    # are not added.
    _apply_jvm_frame_to_sample_v2_frame(
        {"function": "deobf", "module": "com.example.Foo", "lineno": 0},
        frame,
    )
    assert frame == {
        "function": "deobf",
        "module": "com.example.Foo",
        "lineno": 99,
        "data": {"deobfuscation_status": "deobfuscated"},
    }


def test_merge_jvm_frames_with_android_methods_trace_format() -> None:
    profile: dict[str, Any] = {
        "version": "2.android-trace",
        "platform": "android",
        "profile": {
            "methods": [
                {"name": "a", "class_name": "obf.A"},
                {"name": "b", "class_name": "obf.B"},
            ],
        },
    }
    frames = [
        {"function": "deobfA", "index": 0, "module": "com.example.A"},
        {"function": "deobfB", "index": 1, "module": "com.example.B"},
    ]

    merge_jvm_frames_with_android_methods(frames, profile)

    assert profile["profile"]["methods"] == [
        {
            "name": "deobfA",
            "class_name": "com.example.A",
            "data": {"deobfuscation_status": "deobfuscated"},
        },
        {
            "name": "deobfB",
            "class_name": "com.example.B",
            "data": {"deobfuscation_status": "deobfuscated"},
        },
    ]


def test_merge_jvm_frames_with_android_methods_trace_format_inlines() -> None:
    # Two returned frames for the same method index become inline_frames.
    profile: dict[str, Any] = {
        "version": "2.android-trace",
        "platform": "android",
        "profile": {"methods": [{"name": "t", "class_name": "obf.A"}]},
    }
    frames = [
        {"function": "outer", "index": 0, "module": "com.example.A"},
        {"function": "inner", "index": 0, "module": "com.example.A"},
    ]

    merge_jvm_frames_with_android_methods(frames, profile)

    method = profile["profile"]["methods"][0]
    assert method["name"] == "outer"
    assert [f["name"] for f in method["inline_frames"]] == ["outer", "inner"]


def test_merge_jvm_frames_with_sample_v2_basic() -> None:
    # A single deobfuscated frame per index: non-JVM frames are preserved and
    # stacks are left unchanged.
    profile: dict[str, Any] = {
        "version": "2",
        "platform": "android",
        "profile": {
            "frames": [
                {"function": "a", "module": "obf.A", "platform": "java"},
                {"function": "native_fn", "platform": "native"},
            ],
            "stacks": [[0, 1]],
        },
    }
    jvm_frames = [
        {
            "function": "deobfA",
            "index": 0,
            "module": "com.example.A",
            "signature": "()",
            "filename": "A.java",
            "lineno": 10,
            "in_app": True,
        },
    ]

    merge_jvm_frames_with_android_methods(jvm_frames, profile)

    assert profile["profile"]["stacks"] == [[0, 1]]
    assert profile["profile"]["frames"] == [
        {
            "function": "deobfA",
            "module": "com.example.A",
            "platform": "java",
            "data": {"deobfuscation_status": "deobfuscated"},
            "signature": "()",
            "filename": "A.java",
            "lineno": 10,
            "in_app": True,
        },
        {"function": "native_fn", "platform": "native"},
    ]


def test_merge_jvm_frames_with_sample_v2_inline_expansion_remaps_stacks() -> None:
    # One original JVM frame expands into two (inlines). The frame list grows
    # and every stack that referenced the original index is remapped.
    profile: dict[str, Any] = {
        "version": "2",
        "platform": "android",
        "profile": {
            "frames": [
                {"function": "a", "module": "obf.A", "platform": "java"},
                {"function": "native_fn", "platform": "native"},
            ],
            "stacks": [[0, 1], [1, 0]],
        },
    }
    jvm_frames = [
        {"function": "a_inline", "index": 0, "module": "com.example.A"},
        {"function": "a_outer", "index": 0, "module": "com.example.A"},
    ]

    merge_jvm_frames_with_android_methods(jvm_frames, profile)

    # index 0 -> new [0, 1]; index 1 (non-JVM) -> new [2]
    assert profile["profile"]["stacks"] == [[0, 1, 2], [2, 0, 1]]
    assert [f["function"] for f in profile["profile"]["frames"]] == [
        "a_inline",
        "a_outer",
        "native_fn",
    ]
