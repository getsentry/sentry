from __future__ import annotations

import importlib
import textwrap
from pathlib import Path

import pytest

# Module has a hyphen in its name, so use importlib.
_mod = importlib.import_module("calculate-backend-test-shards")
count_tests_in_file = _mod.count_tests_in_file
calculate_shards = _mod.calculate_shards
collect_test_count = _mod.collect_test_count


def _write(tmp_path: Path, source: str) -> Path:
    p = tmp_path / "test_example.py"
    p.write_text(textwrap.dedent(source))
    return p


class TestCountTestsInFile:
    def test_plain_functions(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            def test_a():
                pass

            def test_b():
                pass

            def helper():
                pass
            """,
        )
        assert count_tests_in_file(p) == 2

    def test_methods_in_class(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            class TestFoo:
                def test_one(self):
                    pass

                def test_two(self):
                    pass

                def helper(self):
                    pass
            """,
        )
        assert count_tests_in_file(p) == 2

    def test_parametrize_list(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            import pytest

            @pytest.mark.parametrize("x", [1, 2, 3])
            def test_vals(x):
                pass
            """,
        )
        assert count_tests_in_file(p) == 3

    def test_parametrize_tuple(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            import pytest

            @pytest.mark.parametrize("x", (True, False))
            def test_vals(x):
                pass
            """,
        )
        assert count_tests_in_file(p) == 2

    def test_parametrize_with_pytest_param(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            import pytest

            @pytest.mark.parametrize(
                "x",
                [
                    pytest.param(1, id="one"),
                    pytest.param(2, id="two"),
                ],
            )
            def test_vals(x):
                pass
            """,
        )
        assert count_tests_in_file(p) == 2

    def test_parametrize_empty_list(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            import pytest

            @pytest.mark.parametrize("x", [])
            def test_vals(x):
                pass
            """,
        )
        assert count_tests_in_file(p) == 0

    def test_stacked_parametrize(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            import pytest

            @pytest.mark.parametrize("a", [1, 2])
            @pytest.mark.parametrize("b", ["x", "y", "z"])
            def test_combo(a, b):
                pass
            """,
        )
        assert count_tests_in_file(p) == 6

    def test_variable_reference(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            import pytest

            CASES = [1, 2, 3, 4]

            @pytest.mark.parametrize("x", CASES)
            def test_vals(x):
                pass
            """,
        )
        assert count_tests_in_file(p) == 4

    def test_annotated_assignment_variable(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            from typing import Any
            import pytest

            CASES: list[dict[str, Any]] = [{"a": 1}, {"a": 2}, {"a": 3}]

            @pytest.mark.parametrize("case", CASES)
            def test_vals(case):
                pass
            """,
        )
        assert count_tests_in_file(p) == 3

    def test_stored_decorator(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            import pytest

            clients = pytest.mark.parametrize(
                "client",
                [
                    pytest.param("redis", id="redis"),
                    pytest.param("memcached", id="memcached"),
                ],
            )

            @clients
            def test_get(client):
                pass

            @clients
            def test_set(client):
                pass
            """,
        )
        assert count_tests_in_file(p) == 4

    def test_subscript_reference(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            import pytest

            CASES = (
                ["query", "mode"],
                [("q1", "m1"), ("q2", "m2"), ("q3", "m3")],
            )

            @pytest.mark.parametrize(CASES[0], CASES[1])
            def test_query(query, mode):
                pass
            """,
        )
        assert count_tests_in_file(p) == 3

    def test_unresolvable_parametrize_counts_as_one(self, tmp_path):
        """Function calls and attribute access can't be resolved statically."""
        p = _write(
            tmp_path,
            """\
            import os
            import pytest

            @pytest.mark.parametrize("f", os.listdir("/tmp"))
            def test_files(f):
                pass
            """,
        )
        assert count_tests_in_file(p) == 1

    def test_mixed_resolvable_and_unresolvable(self, tmp_path):
        """One stacked parametrize resolved, one not — resolved one still multiplies."""
        p = _write(
            tmp_path,
            """\
            import pytest

            @pytest.mark.parametrize("a", [1, 2])
            @pytest.mark.parametrize("b", some_func())
            def test_combo(a, b):
                pass
            """,
        )
        # [1, 2] resolves to 2; some_func() does not, so treated as 1.
        # Total = 2 * 1 = 2.
        assert count_tests_in_file(p) == 2

    def test_parametrize_with_ids_kwarg(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            import pytest

            @pytest.mark.parametrize(
                "enabled",
                [True, False],
                ids=["with_feature", "without_feature"],
            )
            def test_feature(enabled):
                pass
            """,
        )
        assert count_tests_in_file(p) == 2

    def test_async_def(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            async def test_async():
                pass
            """,
        )
        assert count_tests_in_file(p) == 1

    def test_non_test_functions_ignored(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            def helper():
                pass

            def setup_module():
                pass

            def teardown_function():
                pass
            """,
        )
        assert count_tests_in_file(p) == 0

    def test_empty_file(self, tmp_path):
        p = tmp_path / "test_empty.py"
        p.write_text("")
        assert count_tests_in_file(p) == 0

    def test_syntax_error(self, tmp_path):
        p = tmp_path / "test_bad.py"
        p.write_text("def test_a(:\n")
        # Regex fast path still finds the def — best-effort count.
        assert count_tests_in_file(p) == 1

    def test_nonexistent_file(self, tmp_path):
        p = tmp_path / "test_nope.py"
        assert count_tests_in_file(p) == 0

    def test_parametrize_tuple_argnames(self, tmp_path):
        """Argnames passed as tuple instead of string."""
        p = _write(
            tmp_path,
            """\
            import pytest

            @pytest.mark.parametrize(
                ("name", "value"),
                [("a", 1), ("b", 2)],
            )
            def test_pairs(name, value):
                pass
            """,
        )
        assert count_tests_in_file(p) == 2

    def test_class_with_parametrize_on_method(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            import pytest

            class TestMath:
                @pytest.mark.parametrize("n", [1, 2, 3])
                def test_square(self, n):
                    pass

                def test_plain(self):
                    pass
            """,
        )
        assert count_tests_in_file(p) == 4

    def test_multiple_classes_and_functions(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            import pytest

            def test_standalone():
                pass

            class TestA:
                def test_one(self):
                    pass

            class TestB:
                @pytest.mark.parametrize("x", [1, 2])
                def test_two(self, x):
                    pass
            """,
        )
        assert count_tests_in_file(p) == 4

    def test_non_parametrize_decorators_ignored(self, tmp_path):
        p = _write(
            tmp_path,
            """\
            import pytest

            @pytest.mark.slow
            @pytest.mark.django_db
            def test_decorated():
                pass
            """,
        )
        assert count_tests_in_file(p) == 1


class TestCalculateShards:
    def test_none_returns_default(self):
        assert calculate_shards(None) == 22

    def test_zero_returns_zero(self):
        assert calculate_shards(0) == 0

    def test_small_count(self):
        assert calculate_shards(100) == 1

    def test_exact_boundary(self):
        assert calculate_shards(300) == 1

    def test_just_over_boundary(self):
        assert calculate_shards(301) == 2

    def test_large_count_capped(self):
        assert calculate_shards(100_000) == 22

    def test_mid_range(self):
        # 1500 / 300 = 5
        assert calculate_shards(1500) == 5

    def test_rounds_up(self):
        # 301 / 300 = 1.003 → ceil = 2
        assert calculate_shards(301) == 2


class TestCollectTestCount:
    def test_selected_tests_file(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)

        # Create two test files.
        (tmp_path / "test_a.py").write_text("def test_one(): pass\ndef test_two(): pass\n")
        (tmp_path / "test_b.py").write_text("def test_three(): pass\n")

        selected = tmp_path / "selected.txt"
        selected.write_text(f"{tmp_path / 'test_a.py'}\n{tmp_path / 'test_b.py'}\n")
        monkeypatch.setenv("SELECTED_TESTS_FILE", str(selected))

        assert collect_test_count() == 3

    def test_selected_tests_file_empty(self, tmp_path, monkeypatch):
        selected = tmp_path / "selected.txt"
        selected.write_text("\n")
        monkeypatch.setenv("SELECTED_TESTS_FILE", str(selected))

        assert collect_test_count() == 0

    def test_selected_tests_file_missing(self, tmp_path, monkeypatch):
        monkeypatch.setenv("SELECTED_TESTS_FILE", str(tmp_path / "nope.txt"))
        assert collect_test_count() is None

    def test_full_suite_walks_tests_dir(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        monkeypatch.delenv("SELECTED_TESTS_FILE", raising=False)

        tests = tmp_path / "tests"
        tests.mkdir()
        (tests / "test_foo.py").write_text("def test_a(): pass\n")

        sub = tests / "sub"
        sub.mkdir()
        (sub / "test_bar.py").write_text("def test_b(): pass\ndef test_c(): pass\n")

        assert collect_test_count() == 3

    def test_full_suite_ignores_excluded_dirs(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        monkeypatch.delenv("SELECTED_TESTS_FILE", raising=False)

        tests = tmp_path / "tests"
        tests.mkdir()
        (tests / "test_ok.py").write_text("def test_a(): pass\n")

        for excluded in ("acceptance", "apidocs", "js", "tools"):
            d = tests / excluded
            d.mkdir()
            (d / "test_skip.py").write_text("def test_no(): pass\n")

        assert collect_test_count() == 1

    def test_ignored_dirs_prefix_does_not_over_match(self, tmp_path, monkeypatch):
        """tests/js/ must not exclude tests/json/."""
        monkeypatch.chdir(tmp_path)
        monkeypatch.delenv("SELECTED_TESTS_FILE", raising=False)

        tests = tmp_path / "tests"
        (tests / "js").mkdir(parents=True)
        (tests / "js" / "test_skip.py").write_text("def test_no(): pass\n")
        (tests / "json").mkdir()
        (tests / "json" / "test_keep.py").write_text("def test_yes(): pass\n")

        assert collect_test_count() == 1

    def test_no_tests_dir(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        monkeypatch.delenv("SELECTED_TESTS_FILE", raising=False)
        assert collect_test_count() is None


SENTRY_TESTS = Path(__file__).resolve().parent.parent.parent.parent / "tests"


@pytest.mark.skipif(
    not SENTRY_TESTS.is_dir(),
    reason="sentry tests/ directory not found",
)
def test_all_sentry_test_files():
    """Parse every test file in the repo — no crashes, every file returns >= 0."""
    ignored = {"tests/acceptance", "tests/apidocs", "tests/js", "tests/tools"}
    files = sorted(
        p
        for p in SENTRY_TESTS.rglob("test_*.py")
        if not any(str(p.relative_to(SENTRY_TESTS.parent)).startswith(d) for d in ignored)
    )
    assert len(files) > 2000, f"expected >2000 test files, found {len(files)}"

    failures = []
    total = 0
    for f in files:
        try:
            n = count_tests_in_file(f)
            assert n >= 0
            total += n
        except Exception as exc:
            failures.append((f, exc))

    assert not failures, f"{len(failures)} files failed:\n" + "\n".join(
        f"  {f}: {e}" for f, e in failures[:20]
    )
    # Sanity-check: the sentry test suite has ~30k tests at the time of writing.
    assert total > 29_000, f"total {total} seems too low"
