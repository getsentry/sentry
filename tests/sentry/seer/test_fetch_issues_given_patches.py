from unittest.mock import Mock, patch

from sentry import eventstore
from sentry.api.serializers import EventSerializer, serialize
from sentry.models.group import Group
from sentry.models.repository import Repository
from sentry.seer.fetch_issues_given_patches import (
    NUM_DAYS_AGO,
    STACKFRAME_COUNT,
    PrFile,
    _add_event_details,
    _get_projects_and_filenames_from_source_file,
    _left_truncated_paths,
    get_issues_related_to_file_patches,
    get_issues_with_event_details_for_file,
    safe_for_fetching_issues,
)
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.sentry.integrations.github.tasks.test_open_pr_comment import CreateEventTestCase


class TestGetIssuesWithEventDetailsForFile(CreateEventTestCase):
    def setUp(self):
        self.group_id = [self._create_event(user_id=str(i)) for i in range(6)][0].group.id

    def test_simple(self):
        group_id = [
            self._create_event(function_names=["blue", "planet"], user_id=str(i)) for i in range(7)
        ][0].group.id
        issues_with_event_details = get_issues_with_event_details_for_file(
            projects=[self.project],
            sentry_filenames=["baz.py"],
            function_names=["world", "planet"],
        )

        issue_ids = [issue["id"] for issue in issues_with_event_details]
        function_names = [issue["function_name"] for issue in issues_with_event_details]
        assert group_id != self.group_id
        assert set(issue_ids) == {group_id, self.group_id}
        assert set(function_names) == {"planet", "world"}

        # Check that each issue is structured like an IssueDetails
        assert all(len(issue["events"]) == 1 for issue in issues_with_event_details)
        events = eventstore.backend.get_events(
            filter=eventstore.Filter(
                event_ids=[issue["events"][0]["id"] for issue in issues_with_event_details],
                project_ids=[self.project.id],
            ),
            tenant_ids={"organization_id": self.project.organization_id},
        )
        for issue, event in zip(issues_with_event_details, events, strict=True):
            assert issue["title"] is not None
            event_dict = issue["events"][0]
            serialized_event = serialize(event, serializer=EventSerializer())
            assert event_dict == serialized_event

    # The rest are mostly copied from tests/sentry/integrations/github/tasks/test_open_pr_comment.py
    def test_filename_mismatch(self):
        group_id = self._create_event(
            filenames=["foo.py", "bar.py"],
        ).group.id

        issues = get_issues_with_event_details_for_file([self.project], ["baz.py"], ["world"])
        issue_ids = [issue["id"] for issue in issues]
        assert group_id != self.group_id
        assert issue_ids == [self.group_id]

    def test_function_name_mismatch(self):
        group_id = self._create_event(
            function_names=["world", "hello"],
        ).group.id

        issues = get_issues_with_event_details_for_file([self.project], ["baz.py"], ["world"])
        issue_ids = [issue["id"] for issue in issues]
        assert group_id != self.group_id
        assert issue_ids == [self.group_id]

    def test_not_first_frame(self):
        group_id = self._create_event(
            function_names=["world", "hello"], filenames=["baz.py", "bar.py"], culprit="hi"
        ).group.id

        issues = get_issues_with_event_details_for_file([self.project], ["baz.py"], ["world"])
        issue_ids = [issue["id"] for issue in issues]
        function_names = [issue["function_name"] for issue in issues]
        assert group_id != self.group_id
        assert set(issue_ids) == {self.group_id, group_id}
        assert function_names == ["world", "world"]

    def test_not_within_frame_limit(self):
        function_names = ["world"] + ["a" for _ in range(STACKFRAME_COUNT)]
        filenames = ["baz.py"] + ["foo.py" for _ in range(STACKFRAME_COUNT)]
        group_id = self._create_event(function_names=function_names, filenames=filenames).group.id

        issues = get_issues_with_event_details_for_file([self.project], ["baz.py"], ["world"])
        issue_ids = [issue["id"] for issue in issues]
        assert group_id != self.group_id
        assert issue_ids == [self.group_id]

    def test_event_too_old(self):
        group_id = self._create_event(
            timestamp=before_now(days=NUM_DAYS_AGO + 1).isoformat(), filenames=["bar.py", "baz.py"]
        ).group.id

        issues = get_issues_with_event_details_for_file([self.project], ["baz.py"], ["world"])
        issue_ids = [issue["id"] for issue in issues]
        assert group_id != self.group_id
        assert issue_ids == [self.group_id]

    def test_empty(self):
        assert (
            get_issues_with_event_details_for_file(
                projects=[],
                sentry_filenames=["baz.py"],
                function_names=["world"],
            )
            == []
        )
        assert (
            get_issues_with_event_details_for_file(
                projects=[self.project],
                sentry_filenames=["baz.notsupported"],
                function_names=["world"],
            )
            == []
        )


def test_safe_for_fetching_issues():
    pr_files: list[PrFile] = [
        {"filename": "foo.py", "patch": "a", "changes": 100, "status": "modified"},
        {"filename": "bar.js", "patch": "b", "changes": 100, "status": "modified"},
        {"filename": "baz.py", "patch": "c", "changes": 100, "status": "added"},
        {"filename": "bee.py", "patch": "d", "changes": 100, "status": "removed"},
        {"filename": "boo.js", "patch": "e", "changes": 0, "status": "renamed"},
        {"filename": "bop.php", "patch": "f", "changes": 100, "status": "modified"},
        {"filename": "doo.rb", "patch": "g", "changes": 100, "status": "modified"},
    ]
    pr_files_safe: list[PrFile] = [
        {"filename": "foo.py", "patch": "a", "changes": 100, "status": "modified"},
        {"filename": "bar.js", "patch": "b", "changes": 100, "status": "modified"},
        {"filename": "bop.php", "patch": "f", "changes": 100, "status": "modified"},
        {"filename": "doo.rb", "patch": "g", "changes": 100, "status": "modified"},
    ]

    assert safe_for_fetching_issues(pr_files) == pr_files_safe

    pr_files_too_many_files = pr_files_safe + [
        {"filename": pr_file["filename"], "patch": "a", "changes": 1, "status": "modified"}
        for pr_file in pr_files_safe
    ]
    assert safe_for_fetching_issues(pr_files_too_many_files) == []

    pr_files_too_many_changes: list[PrFile] = [
        {"filename": "foo.py", "patch": "a", "changes": 1_000, "status": "modified"},
    ]
    assert safe_for_fetching_issues(pr_files_too_many_changes) == []

    pr_files_with_unsupported_language: list[PrFile] = pr_files + [
        {"filename": "ahoy.m8y", "patch": "a", "changes": 100, "status": "modified"},
    ]
    assert safe_for_fetching_issues(pr_files_with_unsupported_language) == pr_files_safe


def test__left_truncated_paths():
    assert _left_truncated_paths("foo.py") == []
    assert _left_truncated_paths("path/foo.py") == ["foo.py"]
    assert _left_truncated_paths("path/to/foo.py") == ["to/foo.py", "foo.py"]
    assert _left_truncated_paths("path/to/foo/bar.py", max_num_paths=2) == [
        "to/foo/bar.py",
        "foo/bar.py",
    ]
    assert _left_truncated_paths("path/to/foo/bar.py", max_num_paths=3) == [
        "to/foo/bar.py",
        "foo/bar.py",
        "bar.py",
    ]


class TestGetIssuesRelatedToFilePatches(IntegrationTestCase, CreateEventTestCase):
    # Mostly copied from tests/sentry/integrations/github/tasks/test_open_pr_comment.py
    base_url = "https://api.github.com"

    def setUp(self):
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

        self.gh_repo: Repository = self.create_repo(
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            project=self.project,
            url="https://github.com/getsentry/sentry",
        )
        self.code_mapping = self.create_code_mapping(project=self.project, repo=self.gh_repo)

        groups: list[Group] = list(Group.objects.all())
        issues_result_set = []
        for group_num, group in enumerate(groups):
            event = group.get_latest_event()
            assert event is not None
            issues_result_set.append(
                {
                    "group_id": group.id,
                    "event_id": event.event_id,
                    "title": f"title_{group_num}",
                    "function_name": f"function_{group_num}",
                }
            )
        self.issues_with_event_details = _add_event_details(
            projects=[self.project],
            issues_result_set=issues_result_set,
            event_timestamp_start=None,
            event_timestamp_end=None,
        )

    def test_missing_repo(self):
        assert (
            get_issues_related_to_file_patches(
                organization_id=1,
                provider="integrations:github",
                external_id="does-not-exist",
                pr_files=[],
            )
            == {}
        )

    def test__get_projects_and_filenames_from_source_file(self):
        projects, filenames = _get_projects_and_filenames_from_source_file(
            self.organization.id, self.gh_repo.id, "some/path/foo.py"
        )
        assert projects == {self.project}
        assert filenames == {"some/path/foo.py", "path/foo.py", "foo.py"}

    @patch("sentry.seer.fetch_issues_given_patches.safe_for_fetching_issues")
    @patch("sentry.seer.fetch_issues_given_patches._get_projects_and_filenames_from_source_file")
    @patch(
        "sentry.integrations.github.tasks.language_parsers.PythonParser.extract_functions_from_patch"
    )
    @patch("sentry.seer.fetch_issues_given_patches.get_issues_with_event_details_for_file")
    def test_get_issues_related_to_file_patches(
        self,
        mock_get_issues_with_event_details_for_file: Mock,
        mock_extract_functions_from_patch: Mock,
        mock_get_projects_and_filenames_from_source_file: Mock,
        mock_safe_for_fetching_issues: Mock,
    ):
        mock_get_issues_with_event_details_for_file.side_effect = (
            lambda *args, **kwargs: self.issues_with_event_details
        )
        mock_extract_functions_from_patch.return_value = ["world", "planet"]
        mock_get_projects_and_filenames_from_source_file.return_value = ({self.project}, {"foo.py"})
        mock_safe_for_fetching_issues.side_effect = lambda x: x

        pr_files: list[PrFile] = [
            {"filename": "foo.py", "patch": "a", "status": "modified", "changes": 1},
            {"filename": "bar.py", "patch": "b", "status": "modified", "changes": 1},
        ]
        filename_to_issues_expected = {
            pr_file["filename"]: self.issues_with_event_details for pr_file in pr_files
        }

        assert self.gh_repo.provider is not None

        filename_to_issues = get_issues_related_to_file_patches(
            organization_id=self.organization.id,
            provider=self.gh_repo.provider,
            external_id=self.gh_repo.external_id,  # type: ignore[arg-type]
            pr_files=pr_files,
        )
        assert filename_to_issues == filename_to_issues_expected

        # Test that we fall back to the first active repo if the the provider is inaccurate
        filename_to_issues_fallback = get_issues_related_to_file_patches(
            organization_id=self.organization.id,
            provider="does-not-exist",
            external_id=self.gh_repo.external_id,  # type: ignore[arg-type]
            pr_files=pr_files,
        )
        assert filename_to_issues_fallback == filename_to_issues_expected
