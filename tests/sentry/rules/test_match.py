from sentry.rules.match import MatchType, match_values


class TestMatchValues:
    def test_equals(self):
        assert match_values(["sentry.example"], "sentry.example", MatchType.EQUAL)
        assert not match_values(["sentry.example"], "sentry.other.example", MatchType.EQUAL)

    def test_does_not_equal(self):
        assert match_values(["sentry.example"], "sentry.other.example", MatchType.NOT_EQUAL)
        assert not match_values(["sentry.example"], "sentry.example", MatchType.NOT_EQUAL)

    def test_starts_with(self):
        assert match_values(["sentry.example"], "sentry.", MatchType.STARTS_WITH)
        assert not match_values(["sentry.example"], "bar.", MatchType.STARTS_WITH)

    def test_does_not_start_with(self):
        assert not match_values(["sentry.example"], "sentry.", MatchType.NOT_STARTS_WITH)
        assert match_values(["sentry.example"], "bar.", MatchType.NOT_STARTS_WITH)

    def test_ends_with(self):
        assert match_values(["sentry.example"], ".example", MatchType.ENDS_WITH)
        assert not match_values(["sentry.example"], ".foo", MatchType.ENDS_WITH)

    def test_does_not_end_with(self):
        assert not match_values(["sentry.example"], ".example", MatchType.NOT_ENDS_WITH)
        assert match_values(["sentry.example"], ".foo", MatchType.NOT_ENDS_WITH)

    def test_contains(self):
        assert match_values(["sentry.example"], "example", MatchType.CONTAINS)
        assert not match_values(["sentry.example"], "foo", MatchType.CONTAINS)

    def test_does_not_contain(self):
        assert not match_values(["sentry.example"], "example", MatchType.NOT_CONTAINS)
        assert match_values(["sentry.example"], "foo", MatchType.NOT_CONTAINS)

    def test_is_in(self):
        assert match_values(["sentry.example"], "sentry.example, biz.baz, foo.bar", MatchType.IS_IN)
        assert not match_values(["sentry.example"], "biz.baz, foo.bar", MatchType.IS_IN)

    def test_not_in(self):
        assert match_values(["sentry.example"], "biz.baz, foo.bar", MatchType.NOT_IN)
        assert not match_values(
            ["sentry.example"], "sentry.example, biz.baz, foo.bar", MatchType.NOT_IN
        )
