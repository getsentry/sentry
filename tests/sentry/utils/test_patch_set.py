import pytest

from sentry.utils.patch_set import (
    FileModification,
    FileModifications,
    patch_to_file_changes,
    patch_to_file_modifications,
)


def test_filename_containing_spaces():
    # regression test for https://sentry.io/organizations/sentry/issues/3279066697
    patch = """\
diff --git a/has spaces/t.sql b/has spaces/t.sql
new file mode 100644
index 0000000..8a9b485
--- /dev/null
+++ b/has spaces/t.sql
@@ -0,0 +1 @@
+select * FROM t;
"""
    expected = [{"path": "has spaces/t.sql", "type": "A"}]
    assert patch_to_file_changes(patch) == expected


@pytest.mark.parametrize(
    "diff_text, expected",
    [
        # Test 1: Pure addition
        (
            """@@ -0,0 +1,3 @@
+def hello():
+    print("Hello")
+    return True
""",
            FileModifications(
                added=[
                    FileModification(
                        path="test.py",
                        lines_added=3,
                        lines_removed=0,
                        lines_modified=0,
                    )
                ],
                removed=[],
                modified=[],
            ),
        ),
        # Test 2: Pure deletion
        (
            """@@ -5,3 +0,0 @@
-def goodbye():
-    print("Goodbye")
-    return False
""",
            FileModifications(
                added=[],
                removed=[
                    FileModification(
                        path="test.py",
                        lines_added=0,
                        lines_removed=3,
                        lines_modified=0,
                    )
                ],
                modified=[],
            ),
        ),
        # Test 3: Simple modification
        (
            """@@ -10,1 +10,1 @@
-    print("Hello World")
+    print("Hello Universe")
""",
            FileModifications(
                added=[],
                removed=[],
                modified=[
                    FileModification(
                        path="test.py",
                        lines_added=0,
                        lines_removed=0,
                        lines_modified=1,
                    )
                ],
            ),
        ),
        # Test 4: Add + Remove not as modification
        (
            """@@ -8,0 +9,1 @@
+    print("Extra logging")
@@ -10,1 +11,0 @@
-    print("Old debug")
""",
            FileModifications(
                added=[],
                removed=[],
                modified=[
                    FileModification(
                        path="test.py",
                        lines_added=1,
                        lines_removed=1,
                        lines_modified=0,
                    )
                ],
            ),
        ),
        # Test 5: Mixed case
        (
            """@@ -4,1 +4,1 @@
-    name = "OldName"
+    name = "NewName"
@@ -6,0 +7,2 @@
+    age = 30
+    country = "UK"
@@ -10,1 +12,0 @@
-    unused_variable = None
""",
            FileModifications(
                added=[],
                removed=[],
                modified=[
                    FileModification(
                        path="test.py",
                        lines_added=2,
                        lines_removed=1,
                        lines_modified=1,
                    )
                ],
            ),
        ),
        # Test 6: Consecutive modifications
        (
            """@@ -20,2 +20,2 @@
-    foo = 1
+    foo = 10
-    bar = 2
+    bar = 20
""",
            FileModifications(
                added=[],
                removed=[],
                modified=[
                    FileModification(
                        path="test.py",
                        lines_added=0,
                        lines_removed=0,
                        lines_modified=2,
                    )
                ],
            ),
        ),
    ],
)
def test_diff_line_counts(diff_text, expected):
    patch = f"""diff --git a/test.py b/test.py
index 0000001..0000002 100644
--- a/test.py
+++ b/test.py
{diff_text}
"""
    assert patch_to_file_modifications(patch) == expected
