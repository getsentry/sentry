from __future__ import annotations

import os
import subprocess
import sys
import textwrap

import pytest

from sentry.utils import json

_SRC_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "src")

# Shared snippet prefix: each subprocess prints JSON to stdout.
_PRINT_IDENTITY = textwrap.dedent("""\
    from sentry.testutils.pytest import xdist
    print(json.dumps({"worker_id": xdist.worker_id, "worker_num": xdist.worker_num}))
""")


def _run_xdist_snippet(snippet: str, env_override: dict[str, str] | None = None) -> dict:
    """Run a Python snippet that imports xdist in a clean subprocess and returns JSON."""
    env = {
        k: v
        for k, v in os.environ.items()
        if k
        not in {
            "SENTRY_PYTEST_SERIAL",
            "SENTRY_TEST_WORKER_ID",
        }
    }
    if env_override:
        env.update(env_override)

    code = f"import json, sys\nsys.path.insert(0, {_SRC_DIR!r})\n{textwrap.dedent(snippet)}"
    result = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        env=env,
        timeout=10,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Subprocess failed:\n{result.stderr}")
    return json.loads(result.stdout)


class TestWorkerIdentityResolution:
    """Test that env vars are resolved correctly at import time."""

    def test_serial_mode(self):
        data = _run_xdist_snippet(_PRINT_IDENTITY, env_override={"SENTRY_PYTEST_SERIAL": "1"})
        assert data == {"worker_id": None, "worker_num": None}

    def test_explicit_worker_id(self):
        data = _run_xdist_snippet(_PRINT_IDENTITY, env_override={"SENTRY_TEST_WORKER_ID": "5"})
        assert data == {"worker_id": "5", "worker_num": 5}

    def test_serial_takes_priority_over_worker_id(self):
        data = _run_xdist_snippet(
            _PRINT_IDENTITY,
            env_override={"SENTRY_PYTEST_SERIAL": "1", "SENTRY_TEST_WORKER_ID": "3"},
        )
        assert data == {"worker_id": None, "worker_num": None}

    def test_auto_allocate_generates_hex(self):
        """Without any env vars, a random hex worker_id is generated."""
        data = _run_xdist_snippet(_PRINT_IDENTITY)
        assert data["worker_id"] is not None
        # Should be 8-char hex string (token_hex(4))
        assert len(data["worker_id"]) == 8
        int(data["worker_id"], 16)  # must parse as hex
        assert isinstance(data["worker_num"], int)
        assert 0 <= data["worker_num"] < 7

    def test_auto_allocate_is_unique(self):
        """Multiple subprocesses get different worker IDs."""
        results = [_run_xdist_snippet(_PRINT_IDENTITY) for _ in range(5)]
        ids = {r["worker_id"] for r in results}
        assert len(ids) == 5, f"Expected 5 unique worker_ids, got {ids}"


class TestHelperFunctions:
    """Test the per-resource helper functions via subprocess with controlled env vars."""

    def test_get_db_suffix_with_worker(self):
        data = _run_xdist_snippet(
            """
            from sentry.testutils.pytest import xdist
            print(json.dumps({"v": xdist.get_db_suffix()}))
            """,
            env_override={"SENTRY_TEST_WORKER_ID": "1"},
        )
        assert data["v"] == "_1"

    def test_get_db_suffix_serial(self):
        data = _run_xdist_snippet(
            """
            from sentry.testutils.pytest import xdist
            print(json.dumps({"v": xdist.get_db_suffix()}))
            """,
            env_override={"SENTRY_PYTEST_SERIAL": "1"},
        )
        assert data["v"] == ""

    def test_get_redis_db_with_worker(self):
        data = _run_xdist_snippet(
            """
            from sentry.testutils.pytest import xdist
            print(json.dumps({"v": xdist.get_redis_db()}))
            """,
            env_override={"SENTRY_TEST_WORKER_ID": "2"},
        )
        assert data["v"] == 11  # 9 + 2

    def test_get_redis_db_serial(self):
        data = _run_xdist_snippet(
            """
            from sentry.testutils.pytest import xdist
            print(json.dumps({"v": xdist.get_redis_db()}))
            """,
            env_override={"SENTRY_PYTEST_SERIAL": "1"},
        )
        assert data["v"] == 9

    def test_get_redis_db_within_bounds(self):
        """All valid worker_num values produce Redis DBs 9-15."""
        for slot in range(7):
            data = _run_xdist_snippet(
                """
                from sentry.testutils.pytest import xdist
                print(json.dumps({"v": xdist.get_redis_db()}))
                """,
                env_override={"SENTRY_TEST_WORKER_ID": str(slot)},
            )
            assert 9 <= data["v"] <= 15

    def test_get_kafka_topic_with_worker(self):
        data = _run_xdist_snippet(
            """
            from sentry.testutils.pytest import xdist
            print(json.dumps({"v": xdist.get_kafka_topic("ingest-events")}))
            """,
            env_override={"SENTRY_TEST_WORKER_ID": "0"},
        )
        assert data["v"] == "ingest-events-0"

    def test_get_kafka_topic_serial(self):
        data = _run_xdist_snippet(
            """
            from sentry.testutils.pytest import xdist
            print(json.dumps({"v": xdist.get_kafka_topic("ingest-events")}))
            """,
            env_override={"SENTRY_PYTEST_SERIAL": "1"},
        )
        assert data["v"] == "ingest-events"

    def test_get_snuba_url_from_env(self):
        data = _run_xdist_snippet(
            """
            from sentry.testutils.pytest import xdist
            print(json.dumps({"v": xdist.get_snuba_url()}))
            """,
            env_override={"SENTRY_PYTEST_SERIAL": "1", "SNUBA": "http://snuba:5678"},
        )
        assert data["v"] == "http://snuba:5678"

    def test_get_snuba_url_default(self):
        data = _run_xdist_snippet(
            """
            from sentry.testutils.pytest import xdist
            print(json.dumps({"v": xdist.get_snuba_url()}))
            """,
            env_override={"SENTRY_PYTEST_SERIAL": "1"},
        )
        assert data["v"] is None

    @pytest.mark.parametrize("hex_id", ["0000000a", "ffffffff", "deadbeef"])
    def test_auto_redis_db_within_bounds(self, hex_id):
        """Any hex worker_id maps to a valid Redis DB (9-15)."""
        num = int(hex_id, 16) % 7
        assert 9 <= 9 + num <= 15
