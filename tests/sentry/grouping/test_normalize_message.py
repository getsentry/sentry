from unittest.mock import Mock

import pytest

from sentry.eventstore.models import Event
from sentry.grouping.strategies.message import normalize_message_for_grouping
from sentry.testutils.helpers.options import override_options


@pytest.fixture
def record_analytics(monkeypatch):
    mock = Mock()
    monkeypatch.setattr("sentry.analytics.record", mock)
    return mock


@pytest.mark.parametrize(
    ("name", "input", "expected"),
    [
        ("email", """blah test@email.com had a problem""", """blah <email> had a problem"""),
        ("url", """blah http://some.email.com had a problem""", """blah <url> had a problem"""),
        (
            "url - existing behavior",
            """blah tcp://user:pass@email.com:10 had a problem""",
            """blah tcp://user:<email>:<int> had a problem""",
        ),
        ("ip", """blah 0.0.0.0 had a problem""", """blah <ip> had a problem"""),
        (
            "UUID",
            """blah 7c1811ed-e98f-4c9c-a9f9-58c757ff494f had a problem""",
            """blah <uuid> had a problem""",
        ),
        (
            "UUID",
            """blah bea691f2-2e25-4bec-6838-e0c44b03d60a/7c1811ed-e98f-4c9c-a9f9-58c757ff494f had a problem""",
            """blah <uuid>/<uuid> had a problem""",
        ),
        (
            "SHA1",
            """blah 5fc35719b9cf96ec602dbc748ff31c587a46961d had a problem""",
            """blah <sha1> had a problem""",
        ),
        (
            "MD5",
            """blah 0751007cd28df267e8e051b51f918c60 had a problem""",
            """blah <md5> had a problem""",
        ),
        (
            "Date",
            """blah 2024-02-20T22:16:36 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC822",
            """blah Mon, 02 Jan 06 15:04 MST had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC822Z",
            """blah Mon, 02 Jan 06 15:04 -0700 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC850",
            """blah Monday, 02-Jan-06 15:04:05 MST had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC1123",
            """blah Mon, 02 Jan 2006 15:04:05 MST had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC1123Z",
            """blah Mon, 02 Jan 2006 15:04:05 -0700 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC3339",
            """blah 2006-01-02T15:04:05Z07:00 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC3339Nano",
            """blah 2006-01-02T15:04:05.999999999Z07:00 had a problem""",
            """blah <date> had a problem""",
        ),
        ("Date - plain", """blah 2006-01-02 had a problem""", """blah <date> had a problem"""),
        ("Date - long", """blah Jan 18, 2019 had a problem""", """blah <date> had a problem"""),
        (
            "Date - Datetime",
            """blah 2006-01-02 15:04:05 had a problem""",
            """blah <date> had a problem""",
        ),
        ("Date - Kitchen", """blah 3:04PM had a problem""", """blah <date> had a problem"""),
        ("Date - Time", """blah 15:04:05 had a problem""", """blah <date> had a problem"""),
        (
            "Date - basic",
            """blah Mon Jan 02, 1999 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Datetime - compressed",
            """blah 20240220 11:55:33.546593 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Datetime - datestamp",
            """blah 2024-02-23 02:13:53.418 had a problem""",
            """blah <date> had a problem""",
        ),
        ("hex", """blah 0x9af8c3b had a problem""", """blah <hex> had a problem"""),
        ("float", """blah 0.23 had a problem""", """blah <float> had a problem"""),
        ("int", """blah 23 had a problem""", """blah <int> had a problem"""),
        ("quoted str", """blah b="1" had a problem""", """blah b=<quoted_str> had a problem"""),
        ("bool", """blah a=true had a problem""", """blah a=<bool> had a problem"""),
        (
            "Duration - ms",
            """blah connection failed after 12345ms 1.899s 3s""",
            """blah connection failed after <duration> <duration> <duration>""",
        ),
        # (
        #     "Uniq ID - sql savepoint",
        #     '''SQL: RELEASE SAVEPOINT "s140177518376768_x2"''',
        #     '''SQL: RELEASE SAVEPOINT "<uniq_id>"''',
        # ),
        # (
        #     "Uniq ID - api gateway",
        #     """API gateway VdLchF7iDo8sVkg= blah""",
        #     """API gateway <uniq_id>= blah""",
        # ),
        # (
        #     "Uniq ID - fb trace",  # TODO: It is possible to have fbtrace_ids without integers.
        #     """fbtrace_id Aba64NMEPMmBwi_cPLaGeeK AugPfq0jxGbto4u3kxn8u6p blah""",
        #     """fbtrace_id <uniq_id> <uniq_id> blah""",
        # ),
        # (
        #     "Uniq ID - word with numerical pre/suffix",
        #     """1password python3 abc123 123abc""",
        #     """1password python3 abc123 123abc""",
        # ),
        (
            "UUID after underscore",
            "[words] look come-look_18d34d42-1aaa-6bac-bce3-4c4a854061d2: true",
            "[words] look come-look<uuid>: true",  # TODO: Should we parameterize bools like this?
        ),
        # (
        #     "Quoted str w/ints - cloudflare trace",
        #     """cloudflare trace 230b030023ae2822-SJC 819cc532aex26akb-SNP blah""",
        #     """cloudflare trace <uniq_id> <uniq_id> blah""",
        # ),
        # New cases to handle better
        # ('''blah tcp://user:pass@email.com:10 had a problem''', '''blah <url> had a problem'''),
        # ('''blah 0.0.0.0:10 had a problem''', '''blah <ip> had a problem'''),
        # JWT. TODO: Handle truncated JWTs?
        # ("JWT", '''blah eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c''', '''blah <jwt>'''),
    ],
)
def test_normalize_message(name, input, expected, record_analytics):
    event = Event(project_id=1, event_id="something")
    with override_options(
        {
            "grouping.experiments.parameterization.uniq_id": 100,
        }
    ):
        assert expected == normalize_message_for_grouping(input, event), f"Case {name} Failed"
