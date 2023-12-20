import pytest
from symbolic.proguard import ProguardMapper

from sentry.profiles.java import deobfuscate_signature, format_signature

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
    mapper = ProguardMapper.open(mapping_file_path)
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
def test_deobfuscate_signature(mapper, obfuscated, expected):
    types = deobfuscate_signature(obfuscated, mapper)
    assert format_signature(types) == expected
