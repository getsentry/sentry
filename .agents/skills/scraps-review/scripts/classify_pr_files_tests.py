#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# ///

from __future__ import annotations

import unittest
from unittest.mock import patch

import classify_pr_files


def pr_file(
    filename: str,
    patch_text: str | None,
    *,
    status: str = "modified",
    changes: int = 2,
    previous_filename: str | None = None,
) -> dict[str, object]:
    file: dict[str, object] = {
        "filename": filename,
        "status": status,
        "changes": changes,
    }
    if patch_text is not None:
        file["patch"] = patch_text
    if previous_filename is not None:
        file["previous_filename"] = previous_filename
    return file


class ImportClassificationTest(unittest.TestCase):
    def test_classifies_module_path_change_as_noise(self) -> None:
        patch_text = """@@ -1 +1 @@
-import {Button} from 'sentry/components/button';
+import {Button} from '@sentry/scraps/button';
"""

        result = classify_pr_files.classify_file(
            pr_file("static/app/example.tsx", patch_text), set()
        )

        self.assertEqual(result["classification"], "noise")
        self.assertEqual(result["reason"], "import-path-only")

    def test_classifies_reexport_path_change_as_noise(self) -> None:
        patch_text = """@@ -1 +1 @@
-export {Button} from 'sentry/components/button';
+export {Button} from '@sentry/scraps/button';
"""

        result = classify_pr_files.classify_file(
            pr_file("static/app/example.tsx", patch_text), set()
        )

        self.assertEqual(result["classification"], "noise")

    def test_classifies_side_effect_import_path_change_as_noise(self) -> None:
        patch_text = """@@ -1 +1 @@
-import 'sentry/styles/old';
+import '@sentry/scraps/new';
"""

        result = classify_pr_files.classify_file(
            pr_file("static/app/example.tsx", patch_text), set()
        )

        self.assertEqual(result["classification"], "noise")

    def test_classifies_multiline_import_path_change_as_noise(self) -> None:
        patch_text = """@@ -3 +3 @@
-} from 'sentry/components/button';
+} from '@sentry/scraps/button';
"""

        result = classify_pr_files.classify_file(
            pr_file("static/app/example.tsx", patch_text), set()
        )

        self.assertEqual(result["classification"], "noise")

    def test_keeps_binding_change_substantive(self) -> None:
        patch_text = """@@ -1 +1 @@
-import {OldButton} from '@sentry/scraps/button';
+import {NewButton} from '@sentry/scraps/button';
"""

        result = classify_pr_files.classify_file(
            pr_file("static/app/example.tsx", patch_text), set()
        )

        self.assertEqual(result["classification"], "substantive")

    def test_keeps_added_import_substantive(self) -> None:
        patch_text = """@@ -1,0 +1 @@
+import {Button} from '@sentry/scraps/button';
"""

        result = classify_pr_files.classify_file(
            pr_file("static/app/example.tsx", patch_text, changes=1), set()
        )

        self.assertEqual(result["classification"], "substantive")

    def test_keeps_dynamic_import_substantive(self) -> None:
        patch_text = """@@ -1 +1 @@
-const oldModule = import('old');
+const oldModule = import('new');
"""

        result = classify_pr_files.classify_file(
            pr_file("static/app/example.tsx", patch_text), set()
        )

        self.assertEqual(result["classification"], "substantive")

    def test_keeps_non_import_from_string_substantive(self) -> None:
        patch_text = """@@ -1 +1 @@
-const source = "copied from 'legacy/path'";
+const source = "copied from '@sentry/scraps/path'";
"""

        result = classify_pr_files.classify_file(
            pr_file("static/app/example.tsx", patch_text), set()
        )

        self.assertEqual(result["classification"], "substantive")

    def test_keeps_exported_from_string_substantive(self) -> None:
        patch_text = """@@ -1 +1 @@
-export const source = "copied from 'legacy/path'";
+export const source = "copied from '@sentry/scraps/path'";
"""

        result = classify_pr_files.classify_file(
            pr_file("static/app/example.tsx", patch_text), set()
        )

        self.assertEqual(result["classification"], "substantive")

    def test_keeps_line_leading_dynamic_import_substantive(self) -> None:
        patch_text = """@@ -1 +1 @@
-import('legacy/path');
+import('@sentry/scraps/path');
"""

        result = classify_pr_files.classify_file(
            pr_file("static/app/example.tsx", patch_text), set()
        )

        self.assertEqual(result["classification"], "substantive")

    def test_keeps_dynamic_import_with_from_string_substantive(self) -> None:
        patch_text = """@@ -1 +1 @@
-import('pkg').then(() => log("loaded from 'legacy/path'"));
+import('pkg').then(() => log("loaded from '@sentry/scraps/path'"));
"""

        result = classify_pr_files.classify_file(
            pr_file("static/app/example.tsx", patch_text), set()
        )

        self.assertEqual(result["classification"], "substantive")


class FileClassificationTest(unittest.TestCase):
    def test_finds_every_destination_component(self) -> None:
        files = [
            pr_file(
                "static/app/components/core/one/index.tsx",
                None,
                status="renamed",
                changes=0,
                previous_filename="static/app/components/one/index.tsx",
            ),
            pr_file(
                "static/app/components/core/two/index.tsx",
                None,
                status="renamed",
                changes=0,
                previous_filename="static/app/components/two/index.tsx",
            ),
        ]

        self.assertEqual(
            classify_pr_files.find_destination_dirs(files),
            {
                "static/app/components/core/one/",
                "static/app/components/core/two/",
            },
        )

    def test_keeps_destination_file_substantive(self) -> None:
        result = classify_pr_files.classify_file(
            pr_file(
                "static/app/components/core/button/index.tsx",
                "@@ -1 +1 @@\n-import 'old';\n+import 'new';",
            ),
            {"static/app/components/core/button/"},
        )

        self.assertEqual(result["reason"], "destination-dir")

    def test_limits_snapshot_noise_to_mocks(self) -> None:
        mock = classify_pr_files.classify_file(
            pr_file("tests/js/sentry-test/snapshots/mocks/button.tsx", "@@"), set()
        )
        harness = classify_pr_files.classify_file(
            pr_file("tests/js/sentry-test/snapshots/snapshot.ts", "@@"), set()
        )

        self.assertEqual(mock["classification"], "noise")
        self.assertEqual(harness["classification"], "substantive")

    def test_classifies_only_zero_change_rename_as_noise(self) -> None:
        pure_rename = classify_pr_files.classify_file(
            pr_file("new.tsx", None, status="renamed", changes=0), set()
        )
        changed_rename = classify_pr_files.classify_file(
            pr_file("new.tsx", None, status="renamed", changes=1), set()
        )

        self.assertEqual(pure_rename["reason"], "pure-rename")
        self.assertEqual(changed_rename["reason"], "patch-unavailable")


class MutationTest(unittest.TestCase):
    @patch("classify_pr_files.subprocess.run")
    def test_passes_path_as_graphql_variable(self, run) -> None:
        path = "static/app/odd'\"; path.tsx"
        run.return_value.returncode = 0

        failures = classify_pr_files.mark_files_viewed("PR_node", [path])

        self.assertEqual(failures, [])
        command = run.call_args.args[0]
        query = command[command.index("-f") + 1]
        self.assertNotIn(path, query)
        self.assertIn(f"path={path}", command)

    @patch("classify_pr_files.subprocess.run")
    def test_reports_failed_paths(self, run) -> None:
        run.return_value.returncode = 1

        failures = classify_pr_files.mark_files_viewed("PR_node", ["one.tsx", "two.tsx"])

        self.assertEqual(failures, ["one.tsx", "two.tsx"])

    @patch("classify_pr_files.mark_files_viewed", return_value=["example.tsx"])
    @patch("classify_pr_files.get_pr_files")
    @patch("classify_pr_files.get_pr_metadata")
    def test_partial_mutation_has_nonzero_exit_status(
        self, get_metadata, get_files, mark_files_viewed
    ) -> None:
        metadata = {"id": "PR_node", "headRefOid": "abc123", "changedFiles": 1}
        get_metadata.side_effect = [metadata, metadata]
        get_files.return_value = [
            pr_file(
                "example.tsx",
                "@@ -1 +1 @@\n-import 'old';\n+import 'new';",
            )
        ]
        approval_token = classify_pr_files.make_approval_token("abc123", ["example.tsx"])

        output, exit_code = classify_pr_files.run("123", True, approval_token)

        self.assertEqual(exit_code, 1)
        self.assertEqual(output["status"], "partial")
        self.assertEqual(output["summary"]["marked_viewed"], 0)
        self.assertEqual(output["failed_to_mark"], ["example.tsx"])
        mark_files_viewed.assert_called_once_with("PR_node", ["example.tsx"])

    @patch("classify_pr_files.mark_files_viewed")
    @patch("classify_pr_files.get_pr_files")
    @patch("classify_pr_files.get_pr_metadata")
    def test_rejects_stale_approval(self, get_metadata, get_files, mark_files_viewed) -> None:
        metadata = {"id": "PR_node", "headRefOid": "abc123", "changedFiles": 1}
        get_metadata.side_effect = [metadata, metadata]
        get_files.return_value = [
            pr_file(
                "example.tsx",
                "@@ -1 +1 @@\n-import 'old';\n+import 'new';",
            )
        ]

        with self.assertRaisesRegex(ValueError, "approval token"):  # noqa: S004
            classify_pr_files.run("123", True, "stale-token")

        mark_files_viewed.assert_not_called()

    @patch("classify_pr_files.get_pr_files", return_value=[])
    @patch("classify_pr_files.get_pr_metadata")
    def test_rejects_truncated_file_list(self, get_metadata, get_files) -> None:
        metadata = {"id": "PR_node", "headRefOid": "abc123", "changedFiles": 3001}
        get_metadata.side_effect = [metadata, metadata]

        with self.assertRaisesRegex(classify_pr_files.GhError, "incomplete"):  # noqa: S004
            classify_pr_files.run("123", False)


class InputTest(unittest.TestCase):
    def test_accepts_sentry_pr_url(self) -> None:
        self.assertEqual(
            classify_pr_files.resolve_pr("https://github.com/getsentry/sentry/pull/123/files"),
            123,
        )

    def test_rejects_other_repository(self) -> None:
        with self.assertRaisesRegex(ValueError, "getsentry/sentry"):  # noqa: S004
            classify_pr_files.resolve_pr("https://github.com/getsentry/other/pull/123")


if __name__ == "__main__":
    unittest.main()
