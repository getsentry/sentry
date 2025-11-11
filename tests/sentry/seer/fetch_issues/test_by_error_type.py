from sentry.models.group import Group
from sentry.seer.fetch_issues import utils
from sentry.seer.fetch_issues.by_error_type import _fetch_issues_from_repo_projects, fetch_issues
from sentry.seer.fetch_issues.utils import get_repo_and_projects
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data


class TestFetchIssuesByErrorType(APITestCase, SnubaTestCase):
    def test_simple(self) -> None:
        release = self.create_release(project=self.project, version="1.0.0")
        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentryA",
            provider="integrations:github",
            external_id="1",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {
                    "values": [
                        {"type": "KeyError", "value": "This a bad error", "data": {"values": []}}
                    ]
                },
            },
            project_id=self.project.id,
        )
        group = event.group
        group.message = "Message to the error"

        assert group is not None
        group.save()

        # Assert only 1 Group object in the database
        assert Group.objects.count() == 1
        group = Group.objects.get()

        # Assert that KeyError matched the exception type
        seer_response = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="KeyError",
        )
        assert "error" not in seer_response
        assert seer_response["issues"][0] == group.id

        full_issues = seer_response["issues_full"][0]
        assert full_issues["metadata"]["filename"] == "raven/scripts/runner.py"
        assert full_issues["metadata"]["function"] == "main"
        assert full_issues["metadata"]["in_app_frame_mix"] == "system-only"
        assert full_issues["metadata"]["initial_priority"] == 75
        assert full_issues["metadata"]["type"] == "KeyError"
        assert full_issues["metadata"]["value"] == "This a bad error"
        assert full_issues["message"] == "Message to the error"
        assert full_issues["title"] == "KeyError: This a bad error"

        # Assert that ValueError did not match the exception type
        seer_response = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="ValueError",
        )
        assert seer_response == {"issues": [], "issues_full": []}

        # Assert latest event is returned
        issue_details = utils.get_latest_issue_event(group.id, self.organization.id)
        assert issue_details["id"] == group.id
        assert issue_details["title"] == "KeyError: This a bad error"
        assert len(issue_details["events"]) == 1
        assert "entries" in issue_details["events"][0]

    def test_multiple_projects(self) -> None:
        release = self.create_release(project=self.project, version="1.0.0")

        # Part of the queried results
        queried_repo = self.create_repo(
            project=self.project,
            name="getsentry/sentryA",
            provider="integrations:github",
            external_id="1",
        )
        self.create_code_mapping(project=self.project, repo=queried_repo)
        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {
                    "values": [
                        {"type": "KeyError", "value": "This a bad error", "data": {"values": []}}
                    ]
                },
            },
            project_id=self.project.id,
        )
        group_1 = event.group
        group_1.save()

        # Part of the queried results
        project_2 = self.create_project(
            name="Project2", slug="Project2", teams=[self.team], fire_project_created=True
        )
        self.create_code_mapping(project=project_2, repo=queried_repo)
        data = load_data("python", timestamp=before_now(minutes=2))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {"values": [{"type": "KeyError", "data": {"values": []}}]},
            },
            project_id=project_2.id,
        )
        group_2 = event.group
        group_2.save()

        # NOT part of the queried results
        organization_3 = self.create_organization(name="Organization3")
        team_3 = self.create_team(organization=organization_3)
        project_3 = self.create_project(
            name="Project3", slug="Project3", teams=[team_3], fire_project_created=True
        )
        not_queried_repo = self.create_repo(
            project=project_3,
            name="getsentry/sentryB",
            provider="integrations:github",
            external_id="2",
        )
        self.create_code_mapping(project=project_3, repo=not_queried_repo)
        data = load_data("python", timestamp=before_now(minutes=3))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {
                    "values": [
                        {"type": "KeyError", "value": "This a bad error", "data": {"values": []}}
                    ]
                },
            },
            project_id=project_3.id,
        )
        group_3 = event.group
        group_3.save()

        # Assert there's 3 Group objects in the database
        assert Group.objects.count() == 3

        # Assert there's 2 Group objects from the results
        seer_response = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="KeyError",
        )
        assert "error" not in seer_response
        assert {group_1.id, group_2.id} == set(seer_response["issues"])
        assert group_3.id not in seer_response["issues"]
        assert group_3.id not in [int(issue["id"]) for issue in seer_response["issues_full"]]

        # Assert latest event is returned
        issue_details = utils.get_latest_issue_event(group_1.id, self.organization.id)
        assert issue_details["id"] == group_1.id
        assert issue_details["title"] == "KeyError: This a bad error"
        assert len(issue_details["events"]) == 1
        assert "entries" in issue_details["events"][0]

    def test_last_seen_filter(self) -> None:
        release = self.create_release(project=self.project, version="1.0.0")
        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentryA",
            provider="integrations:github",
            external_id="1",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        data = load_data("python", timestamp=before_now(minutes=1 * 60 * 24 * 10))  # 10 days ago
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {
                    "values": [
                        {"type": "KeyError", "value": "This a bad error", "data": {"values": []}}
                    ]
                },
            },
            project_id=self.project.id,
        )
        group = event.group
        assert group is not None
        group.save()

        # Assert only 1 Group object in the database
        assert Group.objects.count() == 1
        group = Group.objects.get()

        # Assert that KeyError matched the exception type (within default 90 days)
        seer_response = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="KeyError",
        )
        assert "error" not in seer_response
        assert seer_response["issues"] == [group.id]
        assert seer_response["issues_full"][0]["id"] == str(group.id)
        assert seer_response["issues_full"][0]["title"] == "KeyError: This a bad error"

        # Assert that KeyError did not match when filtered to 9 days
        seer_response = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="KeyError",
            num_days_ago=9,
        )
        assert seer_response == {"issues": [], "issues_full": []}

        # Assert latest event is returned
        issue_details = utils.get_latest_issue_event(group.id, self.organization.id)
        assert issue_details["id"] == group.id
        assert issue_details["title"] == "KeyError: This a bad error"
        assert len(issue_details["events"]) == 1
        assert "entries" in issue_details["events"][0]

    def test_multiple_exception_types(self) -> None:
        release = self.create_release(project=self.project, version="1.0.0")
        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentryA",
            provider="integrations:github",
            external_id="1",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        data = load_data("python", timestamp=before_now(minutes=1 * 60 * 24 * 10))  # 10 days ago
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {
                    "values": [
                        {"type": "KeyError", "value": "voodoo curse", "data": {"values": []}}
                    ]
                },
            },
            project_id=self.project.id,
        )
        group_1 = event.group
        assert group_1 is not None
        group_1.save()

        data = load_data("python", timestamp=before_now(minutes=1 * 60 * 24 * 10))  # 10 days ago
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {
                    "values": [
                        {"type": "ValueError", "value": "This a bad error", "data": {"values": []}}
                    ]
                },
            },
            project_id=self.project.id,
        )
        group_2 = event.group
        assert group_2 is not None
        group_2.save()

        # Assert only 2 Group objects in the database
        assert Group.objects.count() == 2

        # Assert that KeyError matched the exception type
        seer_response = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="KeyError",
        )
        assert "error" not in seer_response
        assert seer_response["issues"] == [group_1.id]
        assert len(seer_response["issues_full"]) == 1
        assert seer_response["issues_full"][0]["id"] == str(group_1.id)
        assert seer_response["issues_full"][0]["title"] == "KeyError: voodoo curse"

        # Assert that ValueError matched the exception type
        seer_response = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="ValueError",
        )
        assert "error" not in seer_response
        assert seer_response["issues"] == [group_2.id]
        assert len(seer_response["issues_full"]) == 1
        assert seer_response["issues_full"][0]["id"] == str(group_2.id)
        assert seer_response["issues_full"][0]["title"] == "ValueError: This a bad error"

    def test_fetch_issues_from_repo_projects_returns_groups(self) -> None:
        """Test that _fetch_issues_from_repo_projects returns a list of Group objects."""
        release = self.create_release(project=self.project, version="1.0.0")
        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentryA",
            provider="integrations:github",
            external_id="1",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {
                    "values": [
                        {"type": "KeyError", "value": "This a bad error", "data": {"values": []}}
                    ]
                },
            },
            project_id=self.project.id,
        )
        expected_group = event.group
        assert expected_group is not None
        expected_group.save()

        # Get repo projects
        repo_projects = get_repo_and_projects(
            organization_id=self.organization.id, provider="integrations:github", external_id="1"
        )

        # Test the internal function directly
        groups = _fetch_issues_from_repo_projects(
            repo_projects=repo_projects, exception_type="KeyError"
        )

        # Verify it returns a list of Group objects
        assert isinstance(groups, list)
        assert len(groups) == 1
        assert isinstance(groups[0], Group)
        assert groups[0].id == expected_group.id

    def test_fetch_issues_from_repo_projects_empty_result(self) -> None:
        """Test that _fetch_issues_from_repo_projects returns empty list when no matches."""
        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentryA",
            provider="integrations:github",
            external_id="1",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        # Get repo projects but don't create any matching events
        repo_projects = get_repo_and_projects(
            organization_id=self.organization.id, provider="integrations:github", external_id="1"
        )

        # Test the internal function directly
        results = _fetch_issues_from_repo_projects(
            repo_projects=repo_projects, exception_type="NonExistentError"
        )

        # Verify it returns an empty list
        assert isinstance(results, list)
        assert len(results) == 0

    def _setup_test_environment(
        self, exception_type: str, exception_value: str = "Test error"
    ) -> Group:
        """Helper to set up test environment with a group containing the specified exception type."""
        release = self.create_release(project=self.project, version="1.0.0")
        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentryA",
            provider="integrations:github",
            external_id="1",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {
                    "values": [
                        {"type": exception_type, "value": exception_value, "data": {"values": []}}
                    ]
                },
            },
            project_id=self.project.id,
        )
        group = event.group
        assert group is not None
        group.save()
        return group

    def _assert_exception_type_matches(
        self, search_exception_type: str, expected_group: Group
    ) -> None:
        """Helper to assert that a search exception type returns the expected group."""
        seer_response = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type=search_exception_type,
        )
        assert "error" not in seer_response
        assert seer_response["issues"] == [expected_group.id]
        assert len(seer_response["issues_full"]) == 1

    def _test_exception_type_variants(
        self, stored_exception_type: str, search_variants: list[str]
    ) -> None:
        """Helper to test multiple search variants against a stored exception type."""
        group = self._setup_test_environment(stored_exception_type)

        for search_exception_type in search_variants:
            with self.subTest(search_exception_type=search_exception_type):
                self._assert_exception_type_matches(search_exception_type, group)

    def test_case_insensitive_matching(self) -> None:
        """Test that exception type matching is case insensitive."""
        search_variants = ["TypeError", "typeerror", "TYPEERROR", "TypeERROR", "tYpEeRrOr"]
        self._test_exception_type_variants("TypeError", search_variants)

    def test_normalized_matching_spaces(self) -> None:
        """Test that exception type matching normalizes spaces and special characters."""
        search_variants = [
            "Runtime Error",
            "RuntimeError",
            "runtime error",
            "runtimeerror",
            "RUNTIME ERROR",
            "RUNTIMEERROR",
            "runtime_error",
            "runtime-error",
        ]
        self._test_exception_type_variants("Runtime Error", search_variants)

    def test_normalized_matching_special_characters(self) -> None:
        """Test that exception type matching normalizes various special characters."""
        search_variants = [
            "HTTP-404-Error",
            "HTTP 404 Error",
            "HTTP_404_Error",
            "HTTP.404.Error",
            "HTTP404Error",
            "http404error",
            "HTTP  404  Error",  # multiple spaces
            "HTTP__404__Error",  # multiple underscores
        ]
        self._test_exception_type_variants("HTTP-404-Error", search_variants)

    def test_normalized_matching_multiple_groups(self) -> None:
        """Test normalized matching works correctly with multiple different exception types."""
        release = self.create_release(project=self.project, version="1.0.0")
        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentryA",
            provider="integrations:github",
            external_id="1",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        # Create first group with "Value Error"
        data1 = load_data("python", timestamp=before_now(minutes=1))
        event1 = self.store_event(
            data={
                **data1,
                "release": release.version,
                "exception": {
                    "values": [
                        {"type": "Value Error", "value": "Bad value", "data": {"values": []}}
                    ]
                },
            },
            project_id=self.project.id,
        )
        group1 = event1.group
        assert group1 is not None
        group1.save()

        # Create second group with "Type-Error"
        data2 = load_data("python", timestamp=before_now(minutes=2))
        event2 = self.store_event(
            data={
                **data2,
                "release": release.version,
                "exception": {
                    "values": [{"type": "Type-Error", "value": "Bad type", "data": {"values": []}}]
                },
            },
            project_id=self.project.id,
        )
        group2 = event2.group
        assert group2 is not None
        group2.save()

        # Test that "valueerror" matches only the first group
        seer_response = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="valueerror",
        )
        assert "error" not in seer_response
        assert seer_response["issues"] == [group1.id]
        assert len(seer_response["issues_full"]) == 1

        # Test that "type error" matches only the second group
        seer_response = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="type error",
        )
        assert "error" not in seer_response
        assert seer_response["issues"] == [group2.id]
        assert len(seer_response["issues_full"]) == 1

        # Test that "runtimeerror" matches neither
        seer_response = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="runtimeerror",
        )
        assert seer_response == {"issues": [], "issues_full": []}

    def test_unicode_normalization_consistency(self) -> None:
        """Test that Unicode characters are handled consistently between Python and SQL."""
        search_variants = [
            "ValueError测试",  # Same Unicode as stored
            "ValueError",  # Just ASCII part
            "ValueError测试αβ",  # Different Unicode chars that normalize to same ASCII
        ]
        self._test_exception_type_variants("ValueError测试", search_variants)
