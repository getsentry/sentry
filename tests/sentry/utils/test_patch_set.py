from sentry.utils.patch_set import patch_to_file_changes


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
