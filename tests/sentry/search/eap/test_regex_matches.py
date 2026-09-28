from unittest import TestCase
from unittest.mock import patch

from sentry.models.organization import Organization
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.regex_matches import MAX_MATCHES_PER_PATTERN, find_regex_matches
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

    def test_returns_none_when_the_query_has_no_regex_filter(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message:ERROR", [{"message": "ERROR disk full"}]
        )

        assert matches is None

    def test_returns_none_when_there_are_no_rows(self) -> None:
        matches = find_regex_matches(self.resolver(), "message://ERROR//", [])

        assert matches is None

    def test_returns_none_when_no_returned_field_is_filtered(self) -> None:
        matches = find_regex_matches(self.resolver(), "message://ERROR//", [{"severity": "error"}])

        assert matches is None

    def test_returns_a_span_per_match_when_a_field_matches(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://ERROR \\[\\d+\\]//",
            [{"message": "ERROR [42] disk full, ERROR [7] again"}],
        )

        assert matches == [
            {
                "message": [
                    {"start": 0, "end": 10, "text": "ERROR [42]"},
                    {"start": 22, "end": 31, "text": "ERROR [7]"},
                ]
            }
        ]

    def test_returns_an_entry_per_row_when_only_some_rows_match(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://^ERROR//",
            [{"message": "ERROR disk full"}, {"message": "WARN disk filling up"}],
        )

        assert matches == [{"message": [{"start": 0, "end": 5, "text": "ERROR"}]}, {}]

    def test_matches_a_secondary_alias_when_the_query_uses_the_primary_one(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://ERROR//", [{"log.body": "ERROR disk full"}]
        )

        assert matches == [{"log.body": [{"start": 0, "end": 5, "text": "ERROR"}]}]

    def test_matches_case_insensitively_when_the_request_asks_for_it(self) -> None:
        matches = find_regex_matches(
            self.resolver(case_insensitive=True),
            "message://ERROR//",
            [{"message": "error disk full"}],
        )

        assert matches == [{"message": [{"start": 0, "end": 5, "text": "error"}]}]

    def test_skips_a_negated_filter_when_it_is_the_only_one(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "!message://WARN//", [{"message": "ERROR disk full"}]
        )

        assert matches is None

    def test_reads_a_filter_nested_in_parentheses(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "(message://ERROR// OR message://WARN//)",
            [{"message": "ERROR then WARN"}],
        )

        assert matches == [
            {
                "message": [
                    {"start": 0, "end": 5, "text": "ERROR"},
                    {"start": 11, "end": 15, "text": "WARN"},
                ]
            }
        ]

    def test_merges_spans_when_two_patterns_overlap(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://disk f// message://k full//",
            [{"message": "disk full"}],
        )

        assert matches == [{"message": [{"start": 0, "end": 9, "text": "disk full"}]}]

    def test_skips_zero_width_matches(self) -> None:
        matches = find_regex_matches(self.resolver(), "message://x*//", [{"message": "abc"}])

        assert matches == [{}]

    def test_bounds_the_scan_when_a_pattern_can_match_the_empty_string(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://[0-9]*//", [{"message": "a" * 5000 + "42"}]
        )

        assert matches == [{}]

    def test_highlights_a_later_filter_when_an_earlier_one_matches_heavily(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://a// message://Z//", [{"message": "a" * 300 + "ZbZbZ"}]
        )

        assert matches == [
            {
                "message": [
                    {"start": 0, "end": 100, "text": "a" * 100},
                    {"start": 300, "end": 301, "text": "Z"},
                    {"start": 302, "end": 303, "text": "Z"},
                    {"start": 304, "end": 305, "text": "Z"},
                ]
            }
        ]

    def test_reports_offsets_javascript_can_slice_with_when_the_value_has_an_emoji(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://ERROR//", [{"message": "\U0001f600 ERROR"}]
        )

        assert matches == [{"message": [{"start": 3, "end": 8, "text": "ERROR"}]}]

    def test_shifts_offsets_past_an_emoji_inside_the_match(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://E.ROR//", [{"message": "E\U0001f600ROR here"}]
        )

        assert matches == [{"message": [{"start": 0, "end": 6, "text": "E\U0001f600ROR"}]}]

    def test_leaves_offsets_alone_for_accented_and_cjk_characters(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://ERROR//", [{"message": "café 中文 ERROR"}]
        )

        assert matches == [{"message": [{"start": 8, "end": 13, "text": "ERROR"}]}]

    def test_merges_overlapping_spans_whichever_order_the_filters_are_in(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://k full// message://disk f//",
            [{"message": "disk full"}],
        )

        assert matches == [{"message": [{"start": 0, "end": 9, "text": "disk full"}]}]

    def test_skips_a_numeric_column_that_shares_an_internal_name_with_the_filter(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "tags[foo,string]://^3//",
            [{"tags[foo,number]": 3.5}],
        )

        assert matches == [{}]

    def test_merges_a_span_that_contains_another(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://disk full// message://sk fu//",
            [{"message": "disk full"}],
        )

        assert matches == [{"message": [{"start": 0, "end": 9, "text": "disk full"}]}]

    def test_skips_an_aggregate_column(self) -> None:
        matches = find_regex_matches(self.resolver(), "message://ERROR//", [{"count(message)": 4}])

        assert matches is None

    def test_highlights_a_later_filter_when_an_earlier_one_matches_the_empty_string(self) -> None:
        # Exactly at the scan cap, so the zero-width filter exhausts its match budget
        rows = [{"message": "a" * 982 + " ERROR ERROR ERROR"}]

        matches = find_regex_matches(self.resolver(), "message://[0-9]*// message://ERROR//", rows)

        assert matches is not None
        assert [span["text"] for span in matches[0]["message"]] == ["ERROR", "ERROR", "ERROR"]

    def test_skips_a_virtual_column_that_shares_an_internal_name_with_the_filter(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "tags[project.slug,string]://^fo//", [{"project.slug": "foo"}]
        )

        assert matches is None

    def test_skips_a_non_ascii_value_that_has_no_matches(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://ERROR//", [{"message": "\u30a8\u30e9\u30fc \U0001f525"}]
        )

        assert matches == [{}]

    def test_does_not_shift_a_span_that_starts_on_an_emoji(self) -> None:
        # The shift counts the astral characters strictly before a position, so one sitting at
        # the position itself must not move it
        matches = find_regex_matches(
            self.resolver(), "message://.*ERROR//", [{"message": "\U0001f525 ERROR disk full"}]
        )

        assert matches == [{"message": [{"start": 0, "end": 8, "text": "\U0001f525 ERROR"}]}]

    def test_caps_how_much_of_a_value_is_scanned_even_when_truncation_allows_more(self) -> None:
        rows = [{"message": "x" * 1_500 + " ERROR"}]

        matches = find_regex_matches(
            self.resolver(), "message://ERROR//", rows, max_string_length=30_000
        )

        assert matches == [{}]

    def test_shifts_a_later_span_past_an_emoji_between_two_matches(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://AA// message://BB//", [{"message": "AA\U0001f600BB"}]
        )

        assert matches == [
            {
                "message": [
                    {"start": 0, "end": 2, "text": "AA"},
                    {"start": 4, "end": 6, "text": "BB"},
                ]
            }
        ]

    def test_combines_a_positive_filter_with_a_negated_one(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://ERROR// !message://WARN//",
            [{"message": "ERROR not WARN"}],
        )

        assert matches == [{"message": [{"start": 0, "end": 5, "text": "ERROR"}]}]

    def test_keeps_a_value_exactly_at_the_truncation_length(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://full$//",
            [{"message": "disk full"}],
            max_string_length=9,
        )

        assert matches == [{"message": [{"start": 5, "end": 9, "text": "full"}]}]

    def test_caps_the_spans_returned_for_one_value(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://a//", [{"message": "a " * (MAX_MATCHES_PER_PATTERN + 50)}]
        )

        assert matches is not None
        assert len(matches[0]["message"]) == MAX_MATCHES_PER_PATTERN

    def test_skips_a_row_whose_value_is_null(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://ERROR//",
            [{"message": "ERROR disk full"}, {"message": None}],
        )

        assert matches == [{"message": [{"start": 0, "end": 5, "text": "ERROR"}]}, {}]

    def test_ignores_the_truncation_marker_when_a_value_was_truncated(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://\\.\\.\\.//",
            [{"message": "connection refused" + "..."}],
            max_string_length=18,
        )

        assert matches == [{}]

    def test_keeps_a_literal_ellipsis_when_the_value_was_not_truncated(self) -> None:
        matches = find_regex_matches(
            self.resolver(),
            "message://\\.\\.\\.//",
            [{"message": "wait..."}],
            max_string_length=64,
        )

        assert matches == [{"message": [{"start": 4, "end": 7, "text": "..."}]}]

    def test_finds_a_real_match_despite_earlier_zero_width_matches(self) -> None:
        matches = find_regex_matches(
            self.resolver(), "message://[0-9]*//", [{"message": "a" * 200 + "42"}]
        )

        assert matches == [{"message": [{"start": 200, "end": 202, "text": "42"}]}]

    def test_highlights_every_row_of_an_ordinary_page(self) -> None:
        rows = [{"message": "ERROR one"} for _ in range(1000)]

        matches = find_regex_matches(self.resolver(), "message://ERROR//", rows)

        assert matches is not None
        assert all(row["message"] for row in matches)

    def test_stops_compiling_filters_once_the_deadline_passes(self) -> None:
        # The clock is read to set the deadline, then once per filter before compiling it
        with patch("sentry.search.eap.regex_matches.monotonic", side_effect=[0, *[100] * 20]):
            matches = find_regex_matches(
                self.resolver(), "message://ERROR//", [{"message": "ERROR one"}]
            )

        assert matches is None

    def test_gives_up_on_the_rows_it_has_not_reached_by_the_deadline(self) -> None:
        rows = [{"message": "ERROR one"}, {"message": "ERROR two"}]

        # Deadline, the one filter, then the first row -- the second row is past it
        with patch("sentry.search.eap.regex_matches.monotonic", side_effect=[0, 0, 0, *[100] * 20]):
            matches = find_regex_matches(self.resolver(), "message://ERROR//", rows)

        assert matches == [{"message": [{"start": 0, "end": 5, "text": "ERROR"}]}, {}]

    def test_stops_trying_a_rows_filters_once_the_deadline_passes(self) -> None:
        rows = [{"message": "ERROR and WARN"}]

        # Deadline, both filters, then the row -- the second filter is past it
        with patch(
            "sentry.search.eap.regex_matches.monotonic", side_effect=[0, 0, 0, 0, *[100] * 20]
        ):
            matches = find_regex_matches(
                self.resolver(), "message://ERROR// message://WARN//", rows
            )

        assert matches == [{"message": [{"start": 0, "end": 5, "text": "ERROR"}]}]

    def test_scans_only_the_start_of_an_enormous_value(self) -> None:
        rows = [{"message": "x" * 1_500 + " ERROR"}]

        matches = find_regex_matches(self.resolver(), "message://ERROR//", rows)

        assert matches == [{}]
