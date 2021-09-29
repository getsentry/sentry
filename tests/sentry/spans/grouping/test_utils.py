import pytest

from sentry.spans.grouping.utils import parse_fingerprint_var


@pytest.mark.parametrize(
    "fingerprint,result",
    [
        ("{{default}}", "default"),
        ("{{ default }}", "default"),
        ("{{ var }}", "var"),
        ("{var}", None),
    ],
)
def test_parse_fingerprint_var(fingerprint, result):
    assert parse_fingerprint_var(fingerprint) == result
