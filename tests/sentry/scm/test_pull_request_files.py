from sentry.scm.pull_request_files import normalize_github_pr_files


def test_maps_and_churn_sorts() -> None:
    raw = [
        {
            "filename": "small.py",
            "status": "modified",
            "additions": 1,
            "deletions": 1,
            "changes": 2,
        },
        {"filename": "big.py", "status": "added", "additions": 40, "deletions": 0, "changes": 40},
    ]
    out = normalize_github_pr_files(raw)
    assert out == [
        {"path": "big.py", "additions": 40, "deletions": 0, "status": "added"},
        {"path": "small.py", "additions": 1, "deletions": 1, "status": "modified"},
    ]


def test_drops_missing_filename_and_unknown_status() -> None:
    raw = [
        {"filename": "", "status": "modified", "additions": 1, "deletions": 0},
        {"filename": "x.py", "status": "copied", "additions": 2, "deletions": 0},
        {"filename": "ok.py", "status": "removed", "additions": 0, "deletions": 5},
    ]
    out = normalize_github_pr_files(raw)
    assert out == [{"path": "ok.py", "additions": 0, "deletions": 5, "status": "removed"}]


def test_empty_input() -> None:
    assert normalize_github_pr_files([]) == []
