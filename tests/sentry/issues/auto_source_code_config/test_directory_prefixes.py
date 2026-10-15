from sentry.issues.auto_source_code_config.directory_prefixes import (
    DEFAULT_PREFIX_CAP,
    directory_prefixes,
    rank_directory_prefixes,
)


class TestDirectoryPrefixes:
    def test_relative_path(self) -> None:
        assert directory_prefixes("src/sentry/web/frontend/views.py") == [
            "src/",
            "src/sentry/",
            "src/sentry/web/",
            "src/sentry/web/frontend/",
        ]

    def test_absolute_path(self) -> None:
        assert directory_prefixes("/usr/src/app/foo.py") == [
            "/usr/",
            "/usr/src/",
            "/usr/src/app/",
        ]

    def test_filename_only_and_empty(self) -> None:
        assert directory_prefixes("views.py") == []
        assert directory_prefixes("") == []

    def test_windows_separators(self) -> None:
        result = directory_prefixes("src\\foo\\bar.py")
        assert result == ["src\\", "src\\foo\\"]
        assert "src\\foo\\bar.py".startswith(result[0])
        assert "src\\foo\\bar.py".startswith(result[1])

    def test_root_file_has_no_prefix(self) -> None:
        assert directory_prefixes("/foo.py") == []

    def test_app_scheme_preserves_triple_slash(self) -> None:
        result = directory_prefixes("app:///src/index.tsx")
        assert result == ["app:///", "app:///src/"]
        assert "app:/" not in result

    def test_app_scheme_file_at_root(self) -> None:
        assert directory_prefixes("app:///index.tsx") == ["app:///"]

    def test_webpack_scheme(self) -> None:
        result = directory_prefixes("webpack:///src/index.js")
        assert result == ["webpack:///", "webpack:///src/"]
        assert all("webpack:///src/index.js".startswith(p) for p in result)

    def test_double_slash_path(self) -> None:
        result = directory_prefixes("//usr/src/foo.py")
        assert result == ["//usr/", "//usr/src/"]
        assert all("//usr/src/foo.py".startswith(p) for p in result)

    def test_unc_path(self) -> None:
        result = directory_prefixes("\\\\server\\share\\file.py")
        assert result == ["\\\\server\\", "\\\\server\\share\\"]
        assert all("\\\\server\\share\\file.py".startswith(p) for p in result)


class TestRankDirectoryPrefixes:
    def test_ranks_by_file_count(self) -> None:
        ranked = rank_directory_prefixes(
            [
                "src/sentry/web/views.py",
                "src/sentry/utils/foo.py",
                "tests/sentry/test_web.py",
            ]
        )
        by_path = {item.path: item.file_count for item in ranked}

        assert by_path["src/"] == 2
        assert by_path["src/sentry/"] == 2
        assert by_path["tests/"] == 1
        assert by_path["src/sentry/web/"] == 1

        top = ranked[:2]
        assert {item.path for item in top} == {"src/", "src/sentry/"}
        assert all(item.file_count == 2 for item in top)
        assert all(item.file_count == 1 for item in ranked[2:])

    def test_duplicate_files_count_once(self) -> None:
        # a/b.py deduped to 1 instance; a\b.py is a distinct path, not a duplicate
        ranked = rank_directory_prefixes(["a/b.py", "a/b.py", "a\\b.py"])
        by_path = {item.path: item.file_count for item in ranked}
        assert by_path["a/"] == 1
        assert by_path["a\\"] == 1

    def test_cap_keeps_highest_counts(self) -> None:
        paths = [f"common/dir{index}/file.py" for index in range(DEFAULT_PREFIX_CAP + 50)]
        ranked = rank_directory_prefixes(paths)

        assert len(ranked) == DEFAULT_PREFIX_CAP
        assert ranked[0].path == "common/"
        assert ranked[0].file_count == DEFAULT_PREFIX_CAP + 50
        assert min(item.file_count for item in ranked) >= 1
