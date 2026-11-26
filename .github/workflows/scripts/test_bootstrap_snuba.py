from __future__ import annotations

import importlib
import threading

import pytest

_mod = importlib.import_module("bootstrap-snuba")


class FakeClickHouse:
    """Records queries in order and fails the RESTORE into `fail_on`."""

    def __init__(self, fail_on: str | None = None, error: OSError | None = None) -> None:
        self.fail_on = fail_on
        self.error = error
        self.queries: list[str] = []

    def __call__(self, sql: str, **kwargs: object) -> str:
        self.queries.append(sql)
        if self.error and sql.startswith("RESTORE") and f" AS {self.fail_on} " in sql:
            raise self.error
        return ""


@pytest.mark.parametrize(
    "error",
    [OSError("Code: 57. Table already exists"), TimeoutError("timed out")],
    ids=["fails-partway", "times-out"],
)
def test_failed_copy_discards_targets_before_bootstrapping(
    monkeypatch: pytest.MonkeyPatch, error: OSError
) -> None:
    clickhouse = FakeClickHouse(fail_on="default_gw2", error=error)
    monkeypatch.setattr(_mod, "clickhouse_query", clickhouse)
    bootstrapped: list[int] = []
    lock = threading.Lock()

    def bootstrap(worker_id: int) -> None:
        with lock:
            bootstrapped.append(worker_id)
            clickhouse.queries.append(f"bootstrap {worker_id}")

    _mod.copy_or_bootstrap(0, range(1, 4), bootstrap)

    assert sorted(bootstrapped) == [1, 2, 3]
    failed = clickhouse.queries.index(
        "RESTORE DATABASE default_gw0 AS default_gw2 FROM Memory('default_gw0')"
    )
    kill, *drops = clickhouse.queries[failed + 1 : failed + 5]
    assert kill.startswith("KILL QUERY WHERE query_id IN (")
    for i in (1, 2, 3):
        assert f"'{_mod.restore_query_id(i)}'" in kill
    assert drops == [f"DROP DATABASE IF EXISTS default_gw{i} SYNC" for i in (1, 2, 3)]
    assert all(q.startswith("bootstrap") for q in clickhouse.queries[failed + 5 :])


def test_successful_copy_does_not_bootstrap(monkeypatch: pytest.MonkeyPatch) -> None:
    clickhouse = FakeClickHouse()
    monkeypatch.setattr(_mod, "clickhouse_query", clickhouse)

    def bootstrap(worker_id: int) -> None:
        raise AssertionError(f"bootstrapped {worker_id}")

    _mod.copy_or_bootstrap(0, range(1, 4), bootstrap)

    assert not any(q.startswith(("KILL", "bootstrap")) for q in clickhouse.queries)
    assert sum(q.startswith("RESTORE") for q in clickhouse.queries) == 3
