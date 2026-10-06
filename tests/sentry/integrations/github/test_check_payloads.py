import pytest

from sentry.integrations.github.check_payloads import (
    is_own_repo_pull_request,
    pull_request_base_repo_id,
    references_own_repo_pull_request,
)


class TestPullRequestBaseRepoId:
    def test_reads_the_nested_id(self) -> None:
        assert pull_request_base_repo_id({"base": {"repo": {"id": 123}}}) == 123

    @pytest.mark.parametrize(
        "ref",
        [
            {},
            {"base": None},
            {"base": {}},
            {"base": {"repo": None}},
            {"base": {"repo": {}}},
            {"base": "junk"},
            {"base": {"repo": []}},
            "junk",
            None,
        ],
    )
    def test_missing_or_malformed_reads_as_none(self, ref: object) -> None:
        """Read before the body is signature-verified, so any level may be junk."""
        assert pull_request_base_repo_id(ref) is None


class TestIsOwnRepoPullRequest:
    def test_matches_across_int_and_str(self) -> None:
        """Callers pass either the payload's int `repository.id` or a str
        `Repository.external_id`, which stores the same value as text."""
        assert is_own_repo_pull_request(123, 123)
        assert is_own_repo_pull_request(123, "123")
        assert is_own_repo_pull_request("123", 123)

    def test_different_repo_is_not_ours(self) -> None:
        assert not is_own_repo_pull_request(456, 123)

    @pytest.mark.parametrize(
        ("base_repo_id", "repo_id"),
        [(None, 123), (123, None), (None, None)],
    )
    def test_unplaceable_is_not_ours(self, base_repo_id: object, repo_id: object) -> None:
        """An entry with no base repo cannot be placed. Every consumer skips it, so
        that the entries they act on match the ones the control parser preserves."""
        assert not is_own_repo_pull_request(base_repo_id, repo_id)


class TestReferencesOwnRepoPullRequest:
    def _event(self, refs: object, repo_id: object = 123) -> dict:
        return {"repository": {"id": repo_id}, "check_run": {"pull_requests": refs}}

    def test_true_for_an_own_repo_entry(self) -> None:
        assert references_own_repo_pull_request(
            self._event([{"base": {"repo": {"id": 123}}}]), "check_run"
        )

    def test_scans_past_a_foreign_entry(self) -> None:
        """GitHub's ordering must not decide this."""
        assert references_own_repo_pull_request(
            self._event([{"base": {"repo": {"id": 456}}}, {"base": {"repo": {"id": 123}}}]),
            "check_run",
        )

    def test_false_for_only_foreign_entries(self) -> None:
        assert not references_own_repo_pull_request(
            self._event([{"base": {"repo": {"id": 456}}}]), "check_run"
        )

    def test_false_for_an_empty_list(self) -> None:
        assert not references_own_repo_pull_request(self._event([]), "check_run")

    def test_false_for_only_unplaceable_entries(self) -> None:
        assert not references_own_repo_pull_request(self._event([{"number": 7}]), "check_run")

    @pytest.mark.parametrize("refs", ["junk", 7, {"not": "a list"}, None])
    def test_false_when_the_list_is_not_a_list(self, refs: object) -> None:
        assert not references_own_repo_pull_request(self._event(refs), "check_run")

    def test_false_without_a_repository_id(self) -> None:
        """Nothing can be placed against an unknown repo, so nothing is ours."""
        assert not references_own_repo_pull_request(
            self._event([{"base": {"repo": {"id": 123}}}], repo_id=None), "check_run"
        )

    def test_container_key_selects_the_event_member(self) -> None:
        event = {
            "repository": {"id": 123},
            "check_suite": {"pull_requests": [{"base": {"repo": {"id": 123}}}]},
        }
        assert references_own_repo_pull_request(event, "check_suite")
        assert not references_own_repo_pull_request(event, "check_run")
