from __future__ import annotations

from sentry.pr_metrics.types import (
    get_referenced_group_ids,
    is_referenced_issue_valid,
    normalize_signal_details,
)


class TestNormalizeSignalDetails:
    def test_none_returns_empty_dict(self) -> None:
        assert normalize_signal_details(None) == {}

    def test_empty_dict_returns_empty_dict(self) -> None:
        assert normalize_signal_details({}) == {}

    def test_legacy_format_promotes_to_pr_body(self) -> None:
        result = normalize_signal_details({"group_ids": [1, 2, 3]})
        assert result == {"pr_body": [1, 2, 3]}

    def test_legacy_format_does_not_overwrite_existing_pr_body(self) -> None:
        # When pr_body is already present, legacy group_ids should NOT replace it.
        result = normalize_signal_details({"group_ids": [1, 2], "pr_body": [5, 6]})
        assert result == {"group_ids": [1, 2], "pr_body": [5, 6]}

    def test_already_keyed_passthrough(self) -> None:
        details = {"pr_body": [10, 20], "push": [30]}
        result = normalize_signal_details(details)
        assert result == details

    def test_returns_copy_not_same_reference(self) -> None:
        details = {"pr_body": [1]}
        result = normalize_signal_details(details)
        assert result is not details


class TestGetReferencedGroupIds:
    def test_none_returns_empty_list(self) -> None:
        assert get_referenced_group_ids(None) == []

    def test_empty_dict_returns_empty_list(self) -> None:
        assert get_referenced_group_ids({}) == []

    def test_flat_key(self) -> None:
        assert get_referenced_group_ids({"pr_body": [3, 1, 2]}) == [1, 2, 3]

    def test_deduplication_across_keys(self) -> None:
        details = {
            "pr_body": [1, 2],
            "push": [2, 3],
        }
        assert get_referenced_group_ids(details) == [1, 2, 3]

    def test_sorted_output(self) -> None:
        details = {"pr_body": [5, 3, 1, 4, 2]}
        result = get_referenced_group_ids(details)
        assert result == sorted(result)

    def test_legacy_format(self) -> None:
        assert get_referenced_group_ids({"group_ids": [10, 20]}) == [10, 20]


class TestIsReferencedIssueValid:
    def test_none_returns_false(self) -> None:
        assert is_referenced_issue_valid(None) is False

    def test_empty_dict_returns_false(self) -> None:
        assert is_referenced_issue_valid({}) is False

    def test_all_empty_lists_returns_false(self) -> None:
        assert is_referenced_issue_valid({"pr_body": [], "push": []}) is False

    def test_flat_key_with_ids_returns_true(self) -> None:
        assert is_referenced_issue_valid({"pr_body": [1]}) is True

    def test_legacy_format_returns_true(self) -> None:
        assert is_referenced_issue_valid({"group_ids": [1, 2]}) is True

    def test_mixed_empty_and_non_empty_returns_true(self) -> None:
        # One key has IDs, another doesn't — should still be valid.
        assert is_referenced_issue_valid({"pr_body": [], "push": [5]}) is True
