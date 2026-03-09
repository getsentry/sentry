from __future__ import annotations

import os
import subprocess
import sys
import textwrap

from sentry.utils import json

_SRC_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "src")

# Shared snippet prefix: each subprocess prints JSON to stdout.
_PRINT_IDENTITY = textwrap.dedent("""\
    from sentry.testutils.pytest import isolation
    print(json.dumps({"worker_id": isolation.worker_id, "worker_num": isolation.worker_num}))
""")


def _run_snippet(snippet: str, env_override: dict[str, str] | None = None) -> dict:
    """Run a Python snippet that imports isolation in a clean subprocess and returns JSON."""
    env = {k: v for k, v in os.environ.items() if k != "PYTEST_XDIST_WORKER"}
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
    """Test that file-lock slots are acquired correctly at import time."""

    def test_auto_allocate_gets_slot(self):
        """Every process gets a file-lock slot automatically."""
        data = _run_snippet(_PRINT_IDENTITY)
        assert data["worker_id"] is not None
        assert isinstance(data["worker_num"], int)
        assert 0 <= data["worker_num"] < 15
        assert data["worker_id"] == str(data["worker_num"])

    def test_auto_allocate_is_unique(self):
        """Multiple concurrent subprocesses get different slots."""
        snippet = textwrap.dedent("""\
            import json, sys, time
            sys.path.insert(0, {src!r})
            from sentry.testutils.pytest import isolation
            print(json.dumps({{"worker_id": isolation.worker_id, "worker_num": isolation.worker_num}}), flush=True)
            time.sleep(3)  # hold the lock
        """).format(src=_SRC_DIR)

        env = {k: v for k, v in os.environ.items() if k != "PYTEST_XDIST_WORKER"}

        procs = []
        for _ in range(5):
            p = subprocess.Popen(
                [sys.executable, "-c", snippet],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
            )
            procs.append(p)

        results = []
        for p in procs:
            line = p.stdout.readline()
            results.append(json.loads(line))

        # Clean up — close pipes before terminating to avoid ResourceWarning.
        for p in procs:
            p.stdout.close()
            p.stderr.close()
            p.terminate()
            p.wait()

        ids = {r["worker_num"] for r in results}
        assert len(ids) == 5, f"Expected 5 unique slots, got {results}"


class TestHelperFunctions:
    """Test per-resource helpers by monkeypatching worker_num in-process."""

    def test_get_db_suffix_slot_0(self):
        """Slot 0 has no suffix (backward-compatible with historical default)."""
        import sentry.testutils.pytest.isolation as iso

        old = iso.worker_num
        try:
            iso.worker_num = 0
            assert iso.get_db_suffix() == ""
        finally:
            iso.worker_num = old

    def test_get_db_suffix_with_worker(self):
        import sentry.testutils.pytest.isolation as iso

        old = iso.worker_num
        try:
            iso.worker_num = 1
            assert iso.get_db_suffix() == "_1"
        finally:
            iso.worker_num = old

    def test_get_redis_db_slot_0(self):
        """Slot 0 returns DB 9 (historical default)."""
        import sentry.testutils.pytest.isolation as iso

        old = iso.worker_num
        try:
            iso.worker_num = 0
            assert iso.get_redis_db() == 9
        finally:
            iso.worker_num = old

    def test_get_redis_db_with_worker(self):
        import sentry.testutils.pytest.isolation as iso

        old = iso.worker_num
        try:
            iso.worker_num = 2
            assert iso.get_redis_db() == 2
        finally:
            iso.worker_num = old

    def test_get_redis_db_all_unique(self):
        """All 15 slots produce unique Redis DBs in 1-15."""
        import sentry.testutils.pytest.isolation as iso

        old = iso.worker_num
        dbs = set()
        try:
            for slot in range(15):
                iso.worker_num = slot
                db = iso.get_redis_db()
                assert 1 <= db <= 15, f"slot {slot} → DB {db} out of range"
                dbs.add(db)
            assert len(dbs) == 15, f"Expected 15 unique DBs, got {dbs}"
        finally:
            iso.worker_num = old

    def test_get_kafka_topic_slot_0(self):
        """Slot 0 returns the base name (no suffix) for backward compat."""
        import sentry.testutils.pytest.isolation as iso

        old = iso.worker_num
        try:
            iso.worker_num = 0
            assert iso.get_kafka_topic("ingest-events") == "ingest-events"
        finally:
            iso.worker_num = old

    def test_get_kafka_topic_with_worker(self):
        import sentry.testutils.pytest.isolation as iso

        old = iso.worker_num
        try:
            iso.worker_num = 1
            assert iso.get_kafka_topic("ingest-events") == "ingest-events-1"
        finally:
            iso.worker_num = old

    def test_get_snuba_url_from_env(self):
        data = _run_snippet(
            """
            from sentry.testutils.pytest import isolation
            print(json.dumps({"v": isolation.get_snuba_url()}))
            """,
            env_override={"SNUBA": "http://snuba:5678"},
        )
        assert data["v"] == "http://snuba:5678"

    def test_get_snuba_url_default(self):
        data = _run_snippet(
            """
            from sentry.testutils.pytest import isolation
            print(json.dumps({"v": isolation.get_snuba_url()}))
            """,
        )
        assert data["v"] is None
