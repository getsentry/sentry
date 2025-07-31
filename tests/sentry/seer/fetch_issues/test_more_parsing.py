from typing import cast

import pytest

from sentry.seer.fetch_issues import more_parsing


class TestPythonParserMore:
    @pytest.fixture
    def parser(self):
        return cast(more_parsing.PythonParserMore, more_parsing.patch_parsers_more["py"])

    def test_python_motivating_example(self, parser: more_parsing.PythonParserMore):
        # from https://github.com/codecov/codecov-api/pull/1196/commits/79487bb433431931406023d9baab2c489ddf3f94
        patch = 'diff --git a/services/components.py b/services/components.py\nindex b7482c97..318e22e0 100644\n--- a/services/components.py\n+++ b/services/components.py\n@@ -26,7 +26,7 @@ def commit_components(commit: Commit, owner: Owner | None) -> List[Component]:\n \n \n def component_filtered_report(\n-    report: Report | None, components: List[Component]\n+    report: Report, components: List[Component]\n ) -> FilteredReport:\n     """\n     Filter a report such that the totals, etc. are only pertaining to the given component.\n'
        assert parser.extract_functions_from_patch(patch) == {
            "commit_components",
            "component_filtered_report",  # not caught by PythonParser
        }

    def test_python(self, parser: more_parsing.PythonParserMore):
        # from https://github.com/getsentry/sentry/pull/61981
        patch = """@@ -36,6 +36,7 @@\n from sentry.templatetags.sentry_helpers import small_count\n from sentry.types.referrer_ids import GITHUB_OPEN_PR_BOT_REFERRER\n from sentry.utils import metrics\n+from sentry.utils.json import JSONData\n from sentry.utils.snuba import raw_snql_query\n \n logger = logging.getLogger(__name__)\n@@ -134,10 +135,10 @@ def get_issue_table_contents(issue_list: List[Dict[str, int]]) -> List[PullReque\n # TODO(cathy): Change the client typing to allow for multiple SCM Integrations\n def safe_for_comment(\n     gh_client: GitHubApiClient, repository: Repository, pull_request: PullRequest\n-) -> bool:\n+) -> Tuple[bool, JSONData]:\n     logger.info("github.open_pr_comment.check_safe_for_comment")\n     try:\n-        pullrequest_resp = gh_client.get_pullrequest(\n+        pr_files = gh_client.get_pullrequest_files(\n             repo=repository.name, pull_number=pull_request.key\n         )\n     except ApiError as e:\n@@ -158,34 +159,47 @@ def safe_for_comment(\n                 tags={"type": GithubAPIErrorType.UNKNOWN.value, "code": e.code},\n             )\n             logger.exception("github.open_pr_comment.unknown_api_error", extra={"error": str(e)})\n-        return False\n+        return False, []\n \n     safe_to_comment = True\n-    if pullrequest_resp["state"] != "open":\n-        metrics.incr(\n-            OPEN_PR_METRICS_BASE.format(key="rejected_comment"), tags={"reason": "incorrect_state"}\n-        )\n-        safe_to_comment = False\n-    if pullrequest_resp["changed_files"] > OPEN_PR_MAX_FILES_CHANGED:\n+\n+    changed_file_count = 0\n+    changed_lines_count = 0\n+\n+    for file in pr_files:\n+        filename = file["filename"]\n+        # don't count the file if it was added or is not a Python file\n+        if file["status"] == "added" or not filename.endswith(".py"):\n+            continue\n+\n+        changed_file_count += 1\n+        changed_lines_count += file["changes"]\n+\n+    if changed_file_count > OPEN_PR_MAX_FILES_CHANGED:\n         metrics.incr(\n             OPEN_PR_METRICS_BASE.format(key="rejected_comment"), tags={"reason": "too_many_files"}\n         )\n         safe_to_comment = False\n-    if pullrequest_resp["additions"] + pullrequest_resp["deletions"] > OPEN_PR_MAX_LINES_CHANGED:\n+    if changed_lines_count > OPEN_PR_MAX_LINES_CHANGED:\n         metrics.incr(\n             OPEN_PR_METRICS_BASE.format(key="rejected_comment"), tags={"reason": "too_many_lines"}\n         )\n         safe_to_comment = False\n-    return safe_to_comment\n \n+    if not safe_to_comment:\n+        pr_files = []\n+\n+    return safe_to_comment, pr_files\n \n-def get_pr_filenames(\n-    gh_client: GitHubApiClient, repository: Repository, pull_request: PullRequest\n-) -> List[str]:\n-    pr_files = gh_client.get_pullrequest_files(repo=repository.name, pull_number=pull_request.key)\n \n+def get_pr_filenames(pr_files: JSONData) -> List[str]:\n     # new files will not have sentry issues associated with them\n-    pr_filenames: List[str] = [file["filename"] for file in pr_files if file["status"] != "added"]\n+    # only fetch Python files\n+    pr_filenames: List[str] = [\n+        file["filename"]\n+        for file in pr_files\n+        if file["status"] != "added" and file["filename"].endswith(".py")\n+    ]\n \n     logger.info("github.open_pr_comment.pr_filenames", extra={"count": len(pr_filenames)})\n     return pr_filenames\n@@ -316,15 +330,22 @@ def open_pr_comment_workflow(pr_id: int) -> None:\n     client = installation.get_client()\n \n     # CREATING THE COMMENT\n-    if not safe_for_comment(gh_client=client, repository=repo, pull_request=pull_request):\n+    logger.info("github.open_pr_comment.check_safe_for_comment")\n+\n+    # fetch the files in the PR and determine if it is safe to comment\n+    safe_to_comment, pr_files = safe_for_comment(\n+        gh_client=client, repository=repo, pull_request=pull_request\n+    )\n+\n+    if not safe_to_comment:\n         logger.info("github.open_pr_comment.not_safe_for_comment")\n         metrics.incr(\n             OPEN_PR_METRICS_BASE.format(key="error"),\n             tags={"type": "unsafe_for_comment"},\n         )\n         return\n \n-    pr_filenames = get_pr_filenames(gh_client=client, repository=repo, pull_request=pull_request)\n+    pr_filenames = get_pr_filenames(pr_files)\n \n     issue_table_contents = {}\n     top_issues_per_file = []"""
        assert parser.extract_functions_from_patch(patch) == {
            "get_issue_table_contents",
            "safe_for_comment",
            "get_pr_filenames",  # not caught by PythonParser
            "open_pr_comment_workflow",
        }

    def test_python_in_class(self, parser: more_parsing.PythonParserMore):
        # from https://github.com/getsentry/sentry/pull/59152
        patch = '@@ -274,6 +274,14 @@ def patch(self, request: Request, organization, member):\n \n         result = serializer.validated_data\n \n+        if getattr(member.flags, "partnership:restricted"):\n+            return Response(\n+                {\n+                    "detail": "This member is managed by an active partnership and cannot be modified until the end of the partnership."\n+                },\n+                status=403,\n+            )\n+\n         for operation in result["operations"]:\n             # we only support setting active to False which deletes the orgmember\n             if self._should_delete_member(operation):\n@@ -310,6 +318,14 @@ def delete(self, request: Request, organization, member) -> Response:\n         """\n         Delete an organization member with a SCIM User DELETE Request.\n         """\n+        if getattr(member.flags, "partnership:restricted"):\n+            return Response(\n+                {\n+                    "detail": "This member is managed by an active partnership and cannot be modified until the end of the partnership."\n+                },\n+                status=403,\n+            )\n+\n         self._delete_member(request, organization, member)\n         metrics.incr("sentry.scim.member.delete", tags={"organization": organization})\n         return Response(status=204)\n@@ -348,6 +364,14 @@ def put(self, request: Request, organization, member):\n             )\n             return Response(context, status=200)\n \n+        if getattr(member.flags, "partnership:restricted"):\n+            return Response(\n+                {\n+                    "detail": "This member is managed by an active partnership and cannot be modified until the end of the partnership."\n+                },\n+                status=403,\n+            )\n+\n         if request.data.get("sentryOrgRole"):\n             # Don\'t update if the org role is the same\n             if ('
        assert parser.extract_functions_from_patch(patch) == {
            "patch",
            "delete",
            "put",
        }

    def test_python_true_negatives(self, parser: more_parsing.PythonParserMore):
        patch = '@@ -101,10 +101,15 @@ class FilterWarningsComponent(BaseComponent[FilterWarningsRequest, FilterWarning\n     @observe(name="Codegen - Relevant Warnings - Filter Warnings Component")\n     @ai_track(description="Codegen - Relevant Warnings - Filter Warnings Component")\n     def invoke(self, request: FilterWarningsRequest) -> FilterWarningsOutput:\n+        # comment added so that patch captures invoke\n+\n         def_var_not_included = 0\n\n         "def in_a_one_line_string_not_included"\n\n+        def added_func_not_included():\n+            return\n+\n         warnings = [\n             warning\n             for warning in request.warnings'
        function_names = parser.extract_functions_from_patch(patch)

        msg = "should only match def followed by whitespaces"
        assert "def_var_not_included" in patch
        assert "def_var_not_included" not in function_names, msg

        msg = "should not match added functions (marked with + in diff)"
        assert "def added_func_not_included" in patch
        assert "added_func_not_included" not in function_names, msg

        msg = "should not match things that are clearly in strings"
        assert '"def in_a_one_line_string_not_included"' in patch
        assert "in_a_one_line_string_not_included" not in function_names, msg

        assert function_names == {"invoke"}
