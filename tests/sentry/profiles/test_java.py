from tempfile import mkstemp

import pytest
from symbolic.proguard import ProguardMapper

from sentry.profiles.java import deobfuscate_signature

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
def mapper():
    _, mapping_file_path = mkstemp()
    with open(mapping_file_path, "wb") as f:
        f.write(PROGUARD_SOURCE)
    mapper = ProguardMapper.open(mapping_file_path)
    assert mapper.has_line_info
    return mapper


@pytest.mark.parametrize(
    ["obfuscated", "expected"],
    [
        ("", ""),
        ("()", "()"),
        ("([I)", "(int[])"),
        ("(III)", "(int, int, int)"),
        ("([Ljava/lang/String;)", "(java.lang.String[])"),
        ("([[J)", "(long[][])"),
        ("(I)I", "(int): int"),
        ("([B)V", "(byte[])"),
    ],
)
def test_deobfuscate_signature(mapper, obfuscated, expected):
    result = deobfuscate_signature(mapper, obfuscated)
    assert result == expected
