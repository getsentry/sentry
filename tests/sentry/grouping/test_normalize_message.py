from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from src.sentry.grouping.strategies.message import normalize_message_for_grouping


@region_silo_test
class NormalizeMesageTest(TestCase):
    def test_normalize_message(
        self,
    ) -> None:
        cases = [
            # Email
            ("""blah test@email.com had a problem""", """blah <email> had a problem"""),
            # URL
            ("""blah http://some.email.com had a problem""", """blah <url> had a problem"""),
            # This one is existing behavior
            (
                """blah tcp://user:pass@email.com:10 had a problem""",
                """blah tcp://user:<email>:<int> had a problem""",
            ),
            # IP
            ("""blah 0.0.0.0 had a problem""", """blah <ip> had a problem"""),
            # UUID
            (
                """blah 7c1811ed-e98f-4c9c-a9f9-58c757ff494f had a problem""",
                """blah <uuid> had a problem""",
            ),
            # SHA1
            (
                """blah 5fc35719b9cf96ec602dbc748ff31c587a46961d had a problem""",
                """blah <sha1> had a problem""",
            ),
            # MD5
            (
                """blah 0751007cd28df267e8e051b51f918c60 had a problem""",
                """blah <md5> had a problem""",
            ),
            # Date
            ("""blah 2022-01-15T08:30:00Z had a problem""", """blah <date> had a problem"""),
            # Hex
            ("""blah 0x9af8c3b had a problem""", """blah <hex> had a problem"""),
            # Float
            ("""blah 0.23 had a problem""", """blah <float> had a problem"""),
            # Int
            ("""blah 23 had a problem""", """blah <int> had a problem"""),
            # Quoted Str
            ("""blah b="1" had a problem""", """blah b=<quoted_str> had a problem"""),
            # Bool
            ("""blah a=true had a problem""", """blah a=<bool> had a problem"""),
        ]
        for case in cases:
            assert case[1] == normalize_message_for_grouping(case[0])
