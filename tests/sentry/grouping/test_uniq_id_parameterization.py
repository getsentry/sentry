import pytest

from sentry.grouping.strategies.message import replace_uniq_ids_in_str


@pytest.mark.parametrize(
    ("name", "input", "expected"),
    [
        (
            "Uniq ID - sql savepoint",
            '''SQL: RELEASE SAVEPOINT "s140177518376768_x2"''',
            """SQL: RELEASE SAVEPOINT <uniq_id>""",
        ),
        (
            "Uniq ID - api gateway",
            """API gateway VdLchF7iDo8sVkg= blah""",
            """API gateway <uniq_id> blah""",
        ),
        (
            "Uniq ID - fb trace",  # TODO: It is possible to have fbtrace_ids without integers.
            """fbtrace_id Aba64NMEPMmBwi_cPLaGeeK AugPfq0jxGbto4u3kxn8u6p blah""",
            """fbtrace_id <uniq_id> <uniq_id> blah""",
        ),
        (
            "Nothing to replace",
            """I am the test words 1password python3 abc123 123abc""",
            """I am the test words 1password python3 abc123 123abc""",
        ),
        (
            "Quoted str w/ints - cloudflare trace",
            """cloudflare trace 230b030023ae2822-SJC 819cc532aex26akb-SNP blah""",
            """cloudflare trace <uniq_id> <uniq_id> blah""",
        ),
        (
            "JWT",
            """blah eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c""",
            """blah <uniq_id>""",
        ),
    ],
)
def test_uniq_id_paramaterization(name, input, expected):
    assert expected == replace_uniq_ids_in_str(input), f"Case {name} Failed"
