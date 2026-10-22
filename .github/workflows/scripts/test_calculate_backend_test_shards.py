from __future__ import annotations

import importlib

import pytest

# Module has a hyphen in its name, so use importlib.
_mod = importlib.import_module("calculate-backend-test-shards")
calculate_shards = _mod.calculate_shards
collect_test_count = _mod.collect_test_count


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

    @pytest.mark.parametrize("test_count, expected_shards", [(503, 2), (0, 0)])
    def test_selected_item_count_without_test_files(
        self, tmp_path, monkeypatch, test_count, expected_shards
    ):
        monkeypatch.chdir(tmp_path)
        monkeypatch.setenv("SELECTED_TEST_ITEM_COUNT", str(test_count))
        monkeypatch.setenv("SELECTED_TESTS_FILE", str(tmp_path / "missing.txt"))
        output = tmp_path / "github_output"
        monkeypatch.setenv("GITHUB_OUTPUT", str(output))

        assert _mod.main() == 0
        assert f"shard-count={expected_shards}\n" in output.read_text()

    @pytest.mark.parametrize("test_count", ["invalid", "-1"])
    def test_invalid_selected_item_count_fails(self, monkeypatch, test_count):
        monkeypatch.setenv("SELECTED_TEST_ITEM_COUNT", test_count)

        assert _mod.main() == 1

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
