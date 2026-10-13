from sentry.seer.agent.client_models import SeerRunState


def _state(pr_id: object) -> SeerRunState:
    return SeerRunState.parse_obj(
        {
            "run_id": 1,
            "blocks": [],
            "status": "completed",
            "updated_at": "2024-01-01T00:00:00Z",
            "repo_pr_states": {"owner/repo": {"repo_name": "owner/repo", "pr_id": pr_id}},
        }
    )


def test_string_pr_id_parses() -> None:
    assert _state("pr_01abc").repo_pr_states["owner/repo"].pr_id == "pr_01abc"


def test_int_pr_id_parses_as_string() -> None:
    assert _state(555).repo_pr_states["owner/repo"].pr_id == "555"


def test_missing_pr_id_parses() -> None:
    assert _state(None).repo_pr_states["owner/repo"].pr_id is None
