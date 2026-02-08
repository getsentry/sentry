from sentry.api.helpers.projects import parse_id_or_slug_params


class TestParseIdOrSlugParams:
    def test_empty_input(self):
        ids, slugs = parse_id_or_slug_params([])
        assert ids == set()
        assert slugs == set()

    def test_numeric_values(self):
        ids, slugs = parse_id_or_slug_params(["1", "2", "3"])
        assert ids == {1, 2, 3}
        assert slugs == set()

    def test_slug_values(self):
        ids, slugs = parse_id_or_slug_params(["my-project", "another-proj"])
        assert ids == set()
        assert slugs == {"my-project", "another-proj"}

    def test_mixed_values(self):
        ids, slugs = parse_id_or_slug_params(["1", "my-project", "42"])
        assert ids == {1, 42}
        assert slugs == {"my-project"}

    def test_empty_strings_are_skipped(self):
        ids, slugs = parse_id_or_slug_params(["", "1", "", "foo"])
        assert ids == {1}
        assert slugs == {"foo"}

    def test_negative_numbers_are_ids(self):
        ids, slugs = parse_id_or_slug_params(["-1"])
        assert ids == {-1}
        assert slugs == set()

    def test_all_access_sigil(self):
        ids, slugs = parse_id_or_slug_params(["$all"])
        assert ids == set()
        assert slugs == {"$all"}

    def test_deduplication(self):
        ids, slugs = parse_id_or_slug_params(["1", "1", "foo", "foo"])
        assert ids == {1}
        assert slugs == {"foo"}

    def test_multiple_dashes_are_slugs(self):
        ids, slugs = parse_id_or_slug_params(["--1", "---5"])
        assert ids == set()
        assert slugs == {"--1", "---5"}

    def test_bare_dash_is_slug(self):
        ids, slugs = parse_id_or_slug_params(["-"])
        assert ids == set()
        assert slugs == {"-"}
