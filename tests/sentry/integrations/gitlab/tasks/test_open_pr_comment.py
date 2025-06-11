from unittest.mock import patch

import responses
from django.utils import timezone

from sentry.integrations.source_code_management.commit_context import (
    OPEN_PR_MAX_FILES_CHANGED,
    OPEN_PR_MAX_LINES_CHANGED,
    PullRequestFile,
)
from sentry.integrations.source_code_management.tasks import open_pr_comment_workflow
from sentry.models.group import Group
from sentry.models.pullrequest import CommentType, PullRequestComment
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from sentry.utils import json
from tests.sentry.integrations.gitlab.tasks.test_pr_comment import GitlabCommentTestCase

pytestmark = [requires_snuba]

DIFFS = {
    "pure_addition": """diff --git a/test.py b/test.py
index 0000001..0000002 100644
--- a/test.py
+++ b/test.py
@@ -0,0 +1,3 @@
+def hello():
+    print("Hello")
+    return True
""",
    "pure_deletion": """diff --git a/test.py b/test.py
index 0000001..0000002 100644
--- a/test.py
+++ b/test.py
@@ -5,3 +0,0 @@
-def goodbye():
-    print("Goodbye")
-    return False
""",
    "simple_modification": """diff --git a/test.py b/test.py
index 0000001..0000002 100644
--- a/test.py
+++ b/test.py
@@ -10,1 +10,1 @@
-    print("Hello World")
+    print("Hello Universe")
""",
    "add_and_remove": """diff --git a/test.py b/test.py
index 0000001..0000002 100644
--- a/test.py
+++ b/test.py
@@ -8,0 +9,1 @@
+    print("Extra logging")
@@ -10,1 +11,0 @@
-    print("Old debug")
""",
    "mixed": """diff --git a/test.py b/test.py
index 0000001..0000002 100644
--- a/test.py
+++ b/test.py
@@ -4,1 +4,1 @@
-    name = "OldName"
+    name = "NewName"
@@ -6,0 +7,2 @@
+    age = 30
+    country = "UK"
@@ -10,1 +12,0 @@
-    unused_variable = None
""",
    "consecutive_modifications": """diff --git a/test.py b/test.py
index 0000001..0000002 100644
--- a/test.py
+++ b/test.py
@@ -20,2 +20,2 @@
-    foo = 1
+    foo = 10
-    bar = 2
+    bar = 20
""",
}


class TestSafeForComment(GitlabCommentTestCase):
    def setUp(self):
        super().setUp()

        self.pr = self.create_pr_issues()

        mock_integration_metrics_patcher = patch("sentry.integrations.gitlab.integration.metrics")
        self.mock_integration_metrics = mock_integration_metrics_patcher.start()
        self.addCleanup(mock_integration_metrics_patcher.stop)

    @responses.activate
    def test_simple(self):
        data = [
            {
                "diff": DIFFS["pure_addition"],
                "new_path": "foo.py",
                "old_path": "foo.py",
                "a_mode": "100644",
                "b_mode": "100644",
                "new_file": True,
                "renamed_file": False,
                "deleted_file": False,
                "generated_file": False,
            },
            {
                "diff": DIFFS["pure_deletion"],
                "new_path": "foo.py",
                "old_path": "foo.py",
                "a_mode": "100644",
                "b_mode": "100644",
                "new_file": False,
                "renamed_file": False,
                "deleted_file": True,
                "generated_file": False,
            },
            {
                "diff": DIFFS["simple_modification"],
                "new_path": "foo.py",
                "old_path": "foo.py",
                "a_mode": "100644",
                "b_mode": "100644",
                "new_file": False,
                "renamed_file": False,
                "deleted_file": False,
                "generated_file": False,
            },
            {
                "diff": DIFFS["add_and_remove"],
                "new_path": "foo.py",
                "old_path": "foo.py",
                "a_mode": "100644",
                "b_mode": "100644",
                "new_file": False,
                "renamed_file": False,
                "deleted_file": False,
                "generated_file": False,
            },
            {
                "diff": DIFFS["mixed"],
                "new_path": "foo.py",
                "old_path": "foo.py",
                "a_mode": "100644",
                "b_mode": "100644",
                "new_file": False,
                "renamed_file": False,
                "deleted_file": False,
                "generated_file": False,
            },
            {
                "diff": DIFFS["consecutive_modifications"],
                "new_path": "foo.py",
                "old_path": "foo.py",
                "a_mode": "100644",
                "b_mode": "100644",
                "new_file": False,
                "renamed_file": False,
                "deleted_file": False,
                "generated_file": False,
            },
        ]

        responses.add(
            responses.GET,
            f"https://example.gitlab.com/api/v4/projects/{self.repo.config['project_id']}/merge_requests/{self.pr.key}/diffs?unidiff=true",
            status=200,
            json=data,
        )

        pr_files = self.open_pr_comment_workflow.safe_for_comment(repo=self.repo, pr=self.pr)

        assert pr_files == [
            data[2],
            data[3],
            data[4],
            data[5],
        ]

    @responses.activate
    def test_too_many_files(self):
        files = OPEN_PR_MAX_FILES_CHANGED + 1

        data = [
            {
                "diff": DIFFS["simple_modification"],
                "new_path": f"foo-{i}.py",
                "old_path": f"foo-{i}.py",
                "a_mode": "100644",
                "b_mode": "100644",
                "new_file": True,
                "renamed_file": False,
                "deleted_file": False,
                "generated_file": False,
            }
            for i in range(files)
        ]

        responses.add(
            responses.GET,
            f"https://example.gitlab.com/api/v4/projects/{self.repo.config['project_id']}/merge_requests/{self.pr.key}/diffs?unidiff=true",
            status=200,
            json=data,
        )

        pr_files = self.open_pr_comment_workflow.safe_for_comment(repo=self.repo, pr=self.pr)

        assert pr_files == []
        self.mock_integration_metrics.incr.assert_called_with(
            "gitlab.open_pr_comment.rejected_comment", tags={"reason": "too_many_files"}
        )

    @responses.activate
    def test_too_many_lines(self):
        lines = OPEN_PR_MAX_LINES_CHANGED + 1

        diff = f"""diff --git a/test.py b/test.py
index 0000001..0000002 100644
--- a/test.py
+++ b/test.py
@@ -10,{lines} +10,{lines} @@""" + (
            """
-    print("Hello World")
+    print("Hello Universe")"""
            * lines
        )

        data = [
            {
                "diff": diff,
                "new_path": "foo.py",
                "old_path": "foo.py",
                "a_mode": "100644",
                "b_mode": "100644",
                "new_file": False,
                "renamed_file": False,
                "deleted_file": False,
                "generated_file": False,
            },
        ]

        responses.add(
            responses.GET,
            f"https://example.gitlab.com/api/v4/projects/{self.repo.config['project_id']}/merge_requests/{self.pr.key}/diffs?unidiff=true",
            status=200,
            json=data,
        )

        pr_files = self.open_pr_comment_workflow.safe_for_comment(repo=self.repo, pr=self.pr)

        assert pr_files == []
        self.mock_integration_metrics.incr.assert_called_with(
            "gitlab.open_pr_comment.rejected_comment", tags={"reason": "too_many_lines"}
        )

    @responses.activate
    def test_error__missing_pr(self):
        responses.add(
            responses.GET,
            f"https://example.gitlab.com/api/v4/projects/{self.repo.config['project_id']}/merge_requests/{self.pr.key}/diffs?unidiff=true",
            status=404,
        )

        pr_files = self.open_pr_comment_workflow.safe_for_comment(repo=self.repo, pr=self.pr)

        assert pr_files == []
        self.mock_integration_metrics.incr.assert_called_with(
            "gitlab.open_pr_comment.api_error", tags={"type": "missing_pr", "code": 404}
        )

    @responses.activate
    def test_error__unknown_api_error(self):
        responses.add(
            responses.GET,
            f"https://example.gitlab.com/api/v4/projects/{self.repo.config['project_id']}/merge_requests/{self.pr.key}/diffs?unidiff=true",
            status=500,
        )

        pr_files = self.open_pr_comment_workflow.safe_for_comment(repo=self.repo, pr=self.pr)

        assert pr_files == []
        self.mock_integration_metrics.incr.assert_called_with(
            "gitlab.open_pr_comment.api_error", tags={"type": "unknown_api_error", "code": 500}
        )


@patch(
    "sentry.integrations.gitlab.integration.GitlabOpenPRCommentWorkflow.get_pr_files_safe_for_comment"
)
@patch(
    "sentry.integrations.gitlab.integration.GitlabOpenPRCommentWorkflow.get_projects_and_filenames_from_source_file"
)
@patch(
    "sentry.integrations.gitlab.integration.GitlabOpenPRCommentWorkflow.get_top_5_issues_by_count_for_file"
)
@patch(
    "sentry.integrations.source_code_management.language_parsers.PythonParser.extract_functions_from_patch"
)
@patch("sentry.integrations.gitlab.integration.metrics")
@patch("sentry.integrations.source_code_management.tasks.metrics")
@patch("sentry.integrations.source_code_management.commit_context.metrics")
@patch("sentry.analytics.record")
class TestOpenPRCommentWorkflow(GitlabCommentTestCase):
    def _create_event(
        self,
        culprit=None,
        timestamp=None,
        filenames=None,
        function_names=None,
        project_id=None,
        user_id=None,
        handled=False,
    ):
        if culprit is None:
            culprit = "issue0"
        if timestamp is None:
            timestamp = before_now(seconds=5).isoformat()
        if filenames is None:
            filenames = ["foo.py", "baz.py"]
        if function_names is None:
            function_names = ["hello", "world"]
        if project_id is None:
            project_id = self.project.id

        assert len(function_names) == len(filenames)

        frames = []
        for i, filename in enumerate(filenames):
            frames.append({"filename": filename, "function": function_names[i]})

        return self.store_event(
            data={
                "message": "hello!",
                "culprit": culprit,
                "platform": "python",
                "timestamp": timestamp,
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "stacktrace": {
                                "frames": frames,
                            },
                            "mechanism": {"handled": handled, "type": "generic"},
                        },
                    ]
                },
                "user": {"id": user_id},
            },
            project_id=project_id,
        )

    def setUp(self):
        super().setUp()
        self.pr = self.create_pr_issues()

        self.user_id = "user_1"
        self.app_id = "app_1"

        self.group_id_1 = [self._create_event(culprit="issue1", user_id=str(i)) for i in range(5)][
            0
        ].group.id
        self.group_id_2 = [
            self._create_event(
                culprit="issue2",
                filenames=["foo.py", "bar.py"],
                function_names=["blue", "planet"],
                user_id=str(i),
            )
            for i in range(6)
        ][0].group.id

        self.groups = [
            {
                "group_id": g.id,
                "event_count": 1000 * (i + 1),
                "function_name": "function_" + str(i),
            }
            for i, g in enumerate(Group.objects.all())
        ]
        self.groups.reverse()

    @responses.activate
    def test_comment_workflow(
        self,
        mock_analytics,
        mock_commit_context_metrics,
        mock_task_metrics,
        mock_integration_metrics,
        mock_extract_functions_from_patch,
        mock_get_top_5_issues_by_count_for_file,
        mock_get_projects_and_filenames_from_source_file,
        mock_get_pr_files_safe_for_comment,
    ):
        # two filenames, the second one has a toggle table
        mock_get_pr_files_safe_for_comment.return_value = [
            PullRequestFile(filename="foo.py", patch="a"),
            PullRequestFile(filename="bar.py", patch="b"),
        ]
        mock_get_projects_and_filenames_from_source_file.return_value = ([self.project], ["foo.py"])
        mock_extract_functions_from_patch.return_value = ["world", "planet"]

        mock_get_top_5_issues_by_count_for_file.return_value = self.groups

        responses.add(
            responses.POST,
            f"https://example.gitlab.com/api/v4/projects/{self.repo.config['project_id']}/merge_requests/{self.pr.key}/notes",
            json={"id": 1},
        )

        open_pr_comment_workflow(self.pr.id)

        data = json.loads(responses.calls[0].request.body)
        raw_groups = [Group.objects.get(id=group["group_id"]) for group in self.groups]

        assert data == {
            "body": f"""\
## 🔍 Existing Issues For Review
Your merge request is modifying functions with the following pre-existing issues:

📄 File: **foo.py**

| Function | Unhandled Issue |
| :------- | :----- |
| **`function_3`** | [**{raw_groups[0].title}**](http://testserver/organizations/{raw_groups[0].project.organization.slug}/issues/{raw_groups[0].id}/?referrer=gitlab-open-pr-bot) {raw_groups[0].culprit} <br> `Event Count:` **4k** |
| **`function_2`** | [**{raw_groups[1].title}**](http://testserver/organizations/{raw_groups[1].project.organization.slug}/issues/{raw_groups[1].id}/?referrer=gitlab-open-pr-bot) {raw_groups[1].culprit} <br> `Event Count:` **3k** |
| **`function_1`** | [**{raw_groups[2].title}**](http://testserver/organizations/{raw_groups[2].project.organization.slug}/issues/{raw_groups[2].id}/?referrer=gitlab-open-pr-bot) {raw_groups[2].culprit} <br> `Event Count:` **2k** |
| **`function_0`** | [**{raw_groups[3].title}**](http://testserver/organizations/{raw_groups[3].project.organization.slug}/issues/{raw_groups[3].id}/?referrer=gitlab-open-pr-bot) {raw_groups[3].culprit} <br> `Event Count:` **1k** |
<details>
<summary><b>📄 File: bar.py (Click to Expand)</b></summary>

| Function | Unhandled Issue |
| :------- | :----- |
| **`function_3`** | [**{raw_groups[0].title}**](http://testserver/organizations/{raw_groups[0].project.organization.slug}/issues/{raw_groups[0].id}/?referrer=gitlab-open-pr-bot) {raw_groups[0].culprit} <br> `Event Count:` **4k** |
| **`function_2`** | [**{raw_groups[1].title}**](http://testserver/organizations/{raw_groups[1].project.organization.slug}/issues/{raw_groups[1].id}/?referrer=gitlab-open-pr-bot) {raw_groups[1].culprit} <br> `Event Count:` **3k** |
| **`function_1`** | [**{raw_groups[2].title}**](http://testserver/organizations/{raw_groups[2].project.organization.slug}/issues/{raw_groups[2].id}/?referrer=gitlab-open-pr-bot) {raw_groups[2].culprit} <br> `Event Count:` **2k** |
| **`function_0`** | [**{raw_groups[3].title}**](http://testserver/organizations/{raw_groups[3].project.organization.slug}/issues/{raw_groups[3].id}/?referrer=gitlab-open-pr-bot) {raw_groups[3].culprit} <br> `Event Count:` **1k** |
</details>"""
        }

        comment = PullRequestComment.objects.get()
        assert comment.external_id == 1
        assert comment.comment_type == CommentType.OPEN_PR

        mock_commit_context_metrics.incr.assert_called_with(
            "gitlab.open_pr_comment.comment_created"
        )
        assert mock_task_metrics.mock_calls == []
        assert mock_integration_metrics.mock_calls == []
        mock_analytics.assert_any_call(
            "open_pr_comment.created",
            comment_id=comment.id,
            org_id=self.organization.id,
            pr_id=comment.pull_request.id,
            language="python",
        )

    @responses.activate
    def test_comment_workflow_comment_exists(
        self,
        mock_analytics,
        mock_commit_context_metrics,
        mock_task_metrics,
        mock_integration_metrics,
        mock_extract_functions_from_patch,
        mock_get_top_5_issues_by_count_for_file,
        mock_get_projects_and_filenames_from_source_file,
        mock_get_pr_files_safe_for_comment,
    ):
        # two filenames, the second one has a toggle table
        mock_get_pr_files_safe_for_comment.return_value = [
            PullRequestFile(filename="foo.py", patch="a"),
            PullRequestFile(filename="bar.py", patch="b"),
        ]
        mock_get_projects_and_filenames_from_source_file.return_value = ([self.project], ["foo.py"])
        mock_extract_functions_from_patch.return_value = ["world", "planet"]

        mock_get_top_5_issues_by_count_for_file.return_value = self.groups

        now = timezone.now()
        PullRequestComment.objects.create(
            external_id=1,
            pull_request=self.pr,
            created_at=now,
            updated_at=now,
            group_ids=[0, 1],
            comment_type=CommentType.OPEN_PR,
        )

        responses.add(
            responses.PUT,
            f"https://example.gitlab.com/api/v4/projects/{self.repo.config['project_id']}/merge_requests/{self.pr.key}/notes/1",
            json={"id": 1},
        )

        open_pr_comment_workflow(self.pr.id)

        comment = PullRequestComment.objects.get()
        assert comment.external_id == 1
        assert comment.comment_type == CommentType.OPEN_PR
        assert comment.created_at != comment.updated_at

        mock_commit_context_metrics.incr.assert_called_with(
            "gitlab.open_pr_comment.comment_updated"
        )
        assert mock_task_metrics.mock_calls == []
        assert mock_integration_metrics.mock_calls == []
        assert mock_analytics.mock_calls == []

    @responses.activate
    def test_comment_workflow_early_return(
        self,
        mock_analytics,
        mock_commit_context_metrics,
        mock_task_metrics,
        mock_integration_metrics,
        mock_extract_functions_from_patch,
        mock_get_top_5_issues_by_count_for_file,
        mock_get_projects_and_filenames_from_source_file,
        mock_get_pr_files_safe_for_comment,
    ):
        # no python files
        mock_get_pr_files_safe_for_comment.return_value = []

        open_pr_comment_workflow(self.pr.id)

        comments = PullRequestComment.objects.all()
        assert len(comments) == 0

        assert mock_commit_context_metrics.mock_calls == []
        mock_task_metrics.incr.assert_called_with("gitlab.open_pr_comment.no_issues")
        assert mock_integration_metrics.mock_calls == []
        assert mock_analytics.mock_calls == []

        # no codemappings
        mock_get_pr_files_safe_for_comment.return_value = [
            PullRequestFile(filename="foo.py", patch="a"),
            PullRequestFile(filename="bar.py", patch="b"),
        ]
        mock_get_projects_and_filenames_from_source_file.return_value = ([], [])

        open_pr_comment_workflow(self.pr.id)

        comments = PullRequestComment.objects.all()
        assert len(comments) == 0

        assert mock_commit_context_metrics.mock_calls == []
        mock_task_metrics.incr.assert_called_with("gitlab.open_pr_comment.no_issues")
        assert mock_integration_metrics.mock_calls == []
        assert mock_analytics.mock_calls == []

        # has codemappings but no functions in diff
        mock_get_projects_and_filenames_from_source_file.return_value = ([self.project], ["foo.py"])
        mock_extract_functions_from_patch.return_value = []

        open_pr_comment_workflow(self.pr.id)

        comments = PullRequestComment.objects.all()
        assert len(comments) == 0

        assert mock_commit_context_metrics.mock_calls == []
        mock_task_metrics.incr.assert_called_with("gitlab.open_pr_comment.no_issues")
        assert mock_integration_metrics.mock_calls == []
        assert mock_analytics.mock_calls == []

        # has codemappings and functions but no issues
        mock_extract_functions_from_patch.return_value = ["world"]

        open_pr_comment_workflow(self.pr.id)

        comments = PullRequestComment.objects.all()
        assert len(comments) == 0

        assert mock_commit_context_metrics.mock_calls == []
        mock_task_metrics.incr.assert_called_with("gitlab.open_pr_comment.no_issues")
        assert mock_integration_metrics.mock_calls == []
        assert mock_analytics.mock_calls == []
