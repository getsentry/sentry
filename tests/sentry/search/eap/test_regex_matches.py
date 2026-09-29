from unittest import TestCase
from unittest.mock import patch

from sentry.models.organization import Organization
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.regex_matches import MAX_MATCHES_PER_VALUE, find_regex_matches
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:ourlogs-regex-searches")
class FindRegexMatchesTest(TestCase):
    def resolver(self, case_insensitive: bool = False) -> SearchResolver:
        return SearchResolver(
            params=SnubaParams(
                organization=Organization(id=1, slug="org-slug"),
                case_insensitive=case_insensitive,
            ),
            config=SearchResolverConfig(),
            definitions=OURLOG_DEFINITIONS,
        )

    def test_is_empty_when_the_query_has_no_regex_filter(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message:ERROR", [{"message": "ERROR disk full"}]
        )

        assert matches == {}

    def test_is_empty_when_there_are_no_rows(self) -> None:
        matches = find_regex_matches(self.resolver(), "message://ERROR//", [])

        assert matches == {}

    def test_is_empty_when_no_returned_field_is_filtered(self) -> None:
        matches = find_regex_matches(self.resolver(), "message://ERROR//", [{"severity": "error"}])

        assert matches == {}

    def test_returns_a_span_per_match_when_a_field_matches(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://ERROR \\[\\d+\\]//",
            [{"message": "ERROR [42] disk full, ERROR [7] again"}],
        )

        assert matches == {0: {"fields": {"message": [(0, 10), (22, 31)]}}}

    def test_keys_an_entry_by_row_index_when_only_some_rows_match(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://^ERROR//",
            [{"message": "ERROR disk full"}, {"message": "WARN disk filling up"}],
        )

        assert matches == {0: {"fields": {"message": [(0, 5)]}}}

    def test_matches_a_secondary_alias_when_the_query_uses_the_primary_one(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://ERROR//", [{"log.body": "ERROR disk full"}]
        )

        assert matches == {0: {"fields": {"log.body": [(0, 5)]}}}

    def test_matches_case_insensitively_when_the_request_asks_for_it(self) -> None:
        matches = find_regex_matches(
            self.resolver(case_insensitive=True),
            "message://ERROR//",
            [{"message": "error disk full"}],
        )

        assert matches == {0: {"fields": {"message": [(0, 5)]}}}

    def test_skips_a_negated_filter_when_it_is_the_only_one(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "!message://WARN//", [{"message": "ERROR disk full"}]
        )

        assert matches == {}

    def test_combines_a_positive_filter_with_a_negated_one(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://ERROR// !message://WARN//",
            [{"message": "ERROR not WARN"}],
        )

        assert matches == {0: {"fields": {"message": [(0, 5)]}}}

    def test_reads_a_filter_nested_in_parentheses(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "(message://ERROR// OR message://WARN//)",
            [{"message": "ERROR then WARN"}],
        )

        assert matches == {0: {"fields": {"message": [(0, 5), (11, 15)]}}}

    def test_merges_spans_when_two_patterns_overlap(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://k full// message://disk f//", [{"message": "disk full"}]
        )

        assert matches == {0: {"fields": {"message": [(0, 9)]}}}

    def test_merges_a_span_that_contains_another(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://disk full// message://sk fu//", [{"message": "disk full"}]
        )

        assert matches == {0: {"fields": {"message": [(0, 9)]}}}

    def test_skips_zero_width_matches(self) -> None:
        matches = find_regex_matches(self.resolver(), "message://x*//", [{"message": "abc"}])

        assert matches == {}

    def test_finds_a_real_match_despite_earlier_zero_width_matches(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://[0-9]*//", [{"message": "a" * 200 + "42"}]
        )

        assert matches == {0: {"fields": {"message": [(200, 202)]}}}

    def test_reports_utf16_offsets_when_the_value_has_an_emoji(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://ERROR//", [{"message": "\U0001f600 ERROR"}]
        )

        assert matches == {0: {"fields": {"message": [(3, 8)]}}}

    def test_shifts_offsets_past_an_emoji_inside_the_match(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://E.ROR//", [{"message": "E\U0001f600ROR here"}]
        )

        assert matches == {0: {"fields": {"message": [(0, 6)]}}}

    def test_does_not_shift_a_span_that_starts_on_an_emoji(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://.*ERROR//", [{"message": "\U0001f525 ERROR disk full"}]
        )

        assert matches == {0: {"fields": {"message": [(0, 8)]}}}

    def test_shifts_a_later_span_past_an_emoji_between_two_matches(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://AA// message://BB//", [{"message": "AA\U0001f600BB"}]
        )

        assert matches == {0: {"fields": {"message": [(0, 2), (4, 6)]}}}

    def test_leaves_offsets_alone_for_accented_and_cjk_characters(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://ERROR//", [{"message": "café 中文 ERROR"}]
        )

        assert matches == {0: {"fields": {"message": [(8, 13)]}}}

    def test_skips_a_non_ascii_value_that_has_no_matches(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://ERROR//", [{"message": "\u30a8\u30e9\u30fc \U0001f525"}]
        )

        assert matches == {}

    def test_skips_a_numeric_column_that_shares_an_internal_name_with_the_filter(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "tags[foo,string]://^3//", [{"tags[foo,number]": 3.5}]
        )

        assert matches == {}

    def test_skips_a_virtual_column_that_shares_an_internal_name_with_the_filter(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "tags[project.slug,string]://^fo//", [{"project.slug": "foo"}]
        )

        assert matches == {}

    def test_skips_an_aggregate_column(self) -> None:
        matches = find_regex_matches(self.resolver(), "message://ERROR//", [{"count(message)": 4}])

        assert matches == {}

    def test_skips_a_row_whose_value_is_null(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://ERROR//",
            [{"message": "ERROR disk full"}, {"message": None}],
        )

        assert matches == {0: {"fields": {"message": [(0, 5)]}}}

    def test_caps_how_much_of_a_value_is_scanned_even_when_truncation_allows_more(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://ERROR//",
            [{"message": "x" * 1_500 + " ERROR"}],
            max_string_length=30_000,
        )

        assert matches == {}

    def test_keeps_a_value_exactly_at_the_truncation_length(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://full$//", [{"message": "disk full"}], max_string_length=9
        )

        assert matches == {0: {"fields": {"message": [(5, 9)]}}}

    def test_ignores_the_truncation_marker_when_a_value_was_truncated(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://\\.\\.\\.//",
            [{"message": "connection refused..."}],
            max_string_length=18,
        )

        assert matches == {}

    def test_keeps_a_literal_ellipsis_when_the_value_was_not_truncated(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://\\.\\.\\.//",
            [{"message": "wait..."}],
            max_string_length=64,
        )

        assert matches == {0: {"fields": {"message": [(4, 7)]}}}

    def test_caps_the_spans_returned_for_one_value(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://a//", [{"message": "a " * (MAX_MATCHES_PER_VALUE + 50)}]
        )

        assert matches == {
            0: {
                "fields": {"message": [(index * 2, index * 2 + 1) for index in range(100)]},
                "truncated": ["message"],
            }
        }

    def test_flags_a_row_as_truncated_when_the_value_outruns_the_scan(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://ERROR//", [{"message": "ERROR " + "x" * 2_000}]
        )

        assert matches == {0: {"fields": {"message": [(0, 5)]}, "truncated": ["message"]}}

    def test_does_not_flag_truncation_when_the_caller_asked_for_a_shorter_value(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://ERROR//",
            [{"message": "ERROR disk full..."}],
            max_string_length=15,
        )

        assert matches == {0: {"fields": {"message": [(0, 5)]}}}

    def test_gives_up_when_the_deadline_has_already_passed(self) -> None:
        with patch("sentry.search.eap.regex_matches.MAX_SCAN_SECONDS", -1):
            matches = find_regex_matches(
                self.resolver(), "message://ERROR//", [{"message": "ERROR disk full"}]
            )

        assert matches == {}

    def test_keeps_the_rows_it_reached_before_the_deadline(self) -> None:
        rows = [{"message": "ERROR one"}, {"message": "ERROR two"}]

        # The clock is read once to set the deadline, then once per row
        with patch("sentry.search.eap.regex_matches.monotonic", side_effect=[0, 0, 100]):
            matches = find_regex_matches(self.resolver(), "message://ERROR//", rows)

        assert matches == {0: {"fields": {"message": [(0, 5)]}}}

    def test_names_only_the_field_that_was_cut_when_another_matched_in_full(self) -> None:
        rows = [{"message": "ERROR " + "x" * 2_000, "log.body": "ERROR short"}]

        matches = find_regex_matches(self.resolver(), "message://ERROR//", rows)

        assert matches == {
            0: {
                "fields": {"message": [(0, 5)], "log.body": [(0, 5)]},
                "truncated": ["message"],
            }
        }

    def test_highlights_a_later_filter_when_an_earlier_one_matches_heavily(self) -> None:
        value = "a " * 200 + "ERROR"

        matches = find_regex_matches(
            self.resolver(), "message://a// message://ERROR//", [{"message": value}]
        )

        assert matches is not None
        assert (value.index("ERROR"), len(value)) in matches[0]["fields"]["message"]
