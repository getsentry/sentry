from __future__ import annotations

from unittest import mock

from sentry.issues.auto_source_code_config.stack_filename_sample import (
    _extract_unique_filenames,
    sample_in_app_filenames,
)
from sentry.testutils.cases import TestCase
from sentry.utils.snuba import SnubaError

SAMPLER_MODULE = "sentry.issues.auto_source_code_config.stack_filename_sample"


class TestExtractUniqueFilenames:
    def test_empty_rows(self) -> None:
        assert _extract_unique_filenames([]) == []

    def test_in_app_false_dropped(self) -> None:
        rows = [
            {
                "exception_frames.filename": ["src/foo.py"],
                "exception_frames.in_app": [False],
            }
        ]
        assert _extract_unique_filenames(rows) == []

    def test_in_app_true_kept(self) -> None:
        rows = [
            {
                "exception_frames.filename": ["src/foo.py"],
                "exception_frames.in_app": [True],
            }
        ]
        assert _extract_unique_filenames(rows) == ["src/foo.py"]

    def test_duplicates_deduplicated(self) -> None:
        rows = [
            {
                "exception_frames.filename": ["src/foo.py", "src/foo.py"],
                "exception_frames.in_app": [True, True],
            }
        ]
        assert len(_extract_unique_filenames(rows)) == 1

    def test_mixed_frames(self) -> None:
        rows = [
            {
                "exception_frames.filename": ["src/foo.py", "vendor/bar.py"],
                "exception_frames.in_app": [True, False],
            }
        ]
        result = _extract_unique_filenames(rows)
        assert "src/foo.py" in result
        assert "vendor/bar.py" not in result


class TestSampleInAppFilenames(TestCase):
    @mock.patch(f"{SAMPLER_MODULE}.raw_snql_query")
    def test_no_events_returns_empty(self, mock_query: mock.MagicMock) -> None:
        mock_query.return_value = {"data": []}
        assert sample_in_app_filenames(self.project) == []

    @mock.patch(f"{SAMPLER_MODULE}.raw_snql_query")
    def test_snuba_error_returns_empty(self, mock_query: mock.MagicMock) -> None:
        mock_query.side_effect = SnubaError("boom")
        assert sample_in_app_filenames(self.project) == []

    @mock.patch(f"{SAMPLER_MODULE}.raw_snql_query")
    def test_returns_in_app_filenames(self, mock_query: mock.MagicMock) -> None:
        mock_query.return_value = {
            "data": [
                {
                    "exception_frames.filename": ["/usr/src/app/foo.py", "/vendor/bar.py"],
                    "exception_frames.in_app": [True, False],
                }
            ]
        }
        result = sample_in_app_filenames(self.project)
        assert "/usr/src/app/foo.py" in result
        assert "/vendor/bar.py" not in result
