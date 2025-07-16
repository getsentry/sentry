from sentry.models.group import Group
from sentry.seer.fetch_issues.fetch_issues_given_exception_type import (
    get_issues_related_to_exception_type,
    get_latest_issue_event,
)
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data


class TestGetIssuesGivenExceptionTypes(APITestCase, SnubaTestCase):
    def test_simple(self):
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
        assert group is not None
        group.save()

        # Assert only 1 Group object in the database
        assert Group.objects.count() == 1
        group = Group.objects.get()

        # Assert that KeyError matched the exception type
        group_ids = get_issues_related_to_exception_type(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="KeyError",
        )
        assert group_ids == {"issues": [group.id]}

        # Assert that ValueError did not match the exception type
        group_ids = get_issues_related_to_exception_type(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="ValueError",
        )
        assert group_ids == {"issues": []}

        # Assert latest event is returned
        results = get_latest_issue_event(group.id)
        assert results["id"] == group.id
        assert results["title"] == "KeyError: This a bad error"
        assert len(results["events"]) == 1
        assert "entries" in results["events"][0]

    def test_multiple_projects(self):
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
        group_ids = get_issues_related_to_exception_type(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="KeyError",
        )
        assert {group_1.id, group_2.id} == set(group_ids["issues"])
        assert group_3.id not in group_ids

        # Assert latest event is returned
        results = get_latest_issue_event(group_1.id)
        assert results["id"] == group_1.id
        assert results["title"] == "KeyError: This a bad error"
        assert len(results["events"]) == 1
        assert "entries" in results["events"][0]

    def test_last_seen_filter(self):
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

        # Assert that KeyError matched the exception type
        group_ids = get_issues_related_to_exception_type(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="KeyError",
        )
        assert group_ids == {"issues": [group.id]}

        # Assert that KeyError matched the exception type
        group_ids = get_issues_related_to_exception_type(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="KeyError",
            num_days_ago=9,
        )
        assert group_ids == {"issues": []}

        # Assert latest event is returned
        results = get_latest_issue_event(group.id)
        assert results["id"] == group.id
        assert results["title"] == "KeyError: This a bad error"
        assert len(results["events"]) == 1
        assert "entries" in results["events"][0]

    def test_multiple_exception_types(self):
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
                "exception": {"values": [{"type": "KeyError", "data": {"values": []}}]},
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

        # Assert only 1 Group object in the database
        assert Group.objects.count() == 2

        # Assert that KeyError matched the exception type
        group_ids = get_issues_related_to_exception_type(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="KeyError",
        )
        assert group_ids == {"issues": [group_1.id]}

        # Assert that ValueError matched the exception type
        group_ids = get_issues_related_to_exception_type(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="ValueError",
        )
        assert group_ids == {"issues": [group_2.id]}

        # Assert latest event is returned
        results = get_latest_issue_event(group_2.id)
        assert results["id"] == group_2.id
        assert results["title"] == "ValueError: This a bad error"
        assert len(results["events"]) == 1
        assert "entries" in results["events"][0]

    def test_repo_does_not_exist(self):
        group_ids = get_issues_related_to_exception_type(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="KeyError",
        )
        assert group_ids == {"error": "Repo does not exist"}

    def test_repository_project_path_config_does_not_exist(self):
        self.create_repo(
            project=self.project,
            name="getsentry/sentryA",
            provider="integrations:github",
            external_id="1",
        )

        group_ids = get_issues_related_to_exception_type(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="1",
            exception_type="KeyError",
        )
        assert group_ids == {"error": "Repo project path config does not exist"}

    def test_group_not_found(self):
        group_ids = get_latest_issue_event(
            group_id=1,
        )
        assert group_ids == {}
