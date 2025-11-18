from django.urls import reverse

from sentry.models.commitauthor import CommitAuthor
from sentry.models.groupowner import GroupOwner, GroupOwnerType, SuspectCommitStrategy
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data

pytestmark = [requires_snuba]


# TODO(dcramer): These tests rely too much on implicit fixtures
class EventCommittersTest(APITestCase):
    def test_simple(self) -> None:
        self.login_as(user=self.user)

        project = self.create_project()

        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={
                "fingerprint": ["group1"],
                "timestamp": min_ago,
            },
            project_id=project.id,
            default_event_type=EventType.DEFAULT,
        )

        # Create a commit and GroupOwner to simulate SCM-based suspect commit detection
        repo = self.create_repo(project=project, name="example/repo")
        commit = self.create_commit(project=project, repo=repo)
        assert event.group is not None
        GroupOwner.objects.create(
            group_id=event.group.id,
            project=project,
            organization_id=project.organization_id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=self.user.id,
            context={
                "commitId": commit.id,
                "suspectCommitStrategy": SuspectCommitStrategy.RELEASE_BASED,
            },
        )

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_id_or_slug": event.project.slug,
                "organization_id_or_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data["committers"]) == 1
        assert response.data["committers"][0]["author"]["username"] == "admin@localhost"
        commits = response.data["committers"][0]["commits"]
        assert len(commits) == 1
        assert commits[0]["message"] == commit.message
        assert commits[0]["suspectCommitType"] == "via commit in release"

        group_owner = GroupOwner.objects.get(
            group=event.group, type=GroupOwnerType.SUSPECT_COMMIT.value
        )
        assert "group_owner_id" in response.data["committers"][0]
        assert response.data["committers"][0]["group_owner_id"] == group_owner.id

    def test_no_group(self) -> None:
        self.login_as(user=self.user)

        project = self.create_project()

        min_ago = before_now(minutes=1).isoformat()
        event_data = load_data("transaction")
        event_data["start_timestamp"] = min_ago
        event_data["timestamp"] = min_ago

        event = self.store_event(data=event_data, project_id=project.id)

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_id_or_slug": event.project.slug,
                "organization_id_or_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 404, response.content
        assert response.data["detail"] == "Issue not found"

    def test_no_committers(self) -> None:
        """Test that events without GroupOwners return 404"""
        self.login_as(user=self.user)

        project = self.create_project()

        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago}, project_id=project.id
        )

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_id_or_slug": event.project.slug,
                "organization_id_or_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 404, response.content
        assert response.data["detail"] == "No committers found"

    def test_with_committers(self) -> None:
        self.login_as(user=self.user)
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="example",
            integration_id=self.integration.id,
        )
        self.commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.create_commit_author(project=self.project, user=self.user),
            key="asdfwreqr",
            message="placeholder commit message",
        )
        event = self.store_event(
            data={
                "fingerprint": ["group1"],
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert event.group is not None

        GroupOwner.objects.create(
            group=event.group,
            user_id=self.user.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": self.commit.id},
        )

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_id_or_slug": event.project.slug,
                "organization_id_or_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data["committers"]) == 1
        assert response.data["committers"][0]["author"]["username"] == "admin@localhost"
        commits = response.data["committers"][0]["commits"]
        assert len(commits) == 1
        assert commits[0]["message"] == "placeholder commit message"
        assert commits[0]["suspectCommitType"] == "via SCM integration"

        group_owner = GroupOwner.objects.get(
            group=event.group, type=GroupOwnerType.SUSPECT_COMMIT.value
        )
        assert "group_owner_id" in response.data["committers"][0]
        assert response.data["committers"][0]["group_owner_id"] == group_owner.id

    def test_with_commit_context_pull_request(self) -> None:
        self.login_as(user=self.user)
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="example",
            integration_id=self.integration.id,
        )
        commit_author = self.create_commit_author(project=self.project, user=self.user)
        self.commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=commit_author,
            key="asdfwreqr",
            message="placeholder commit message",
        )
        pull_request = PullRequest.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="9",
            author=commit_author,
            message="waddap",
            title="cool pr",
            merge_commit_sha=self.commit.key,
        )
        event = self.store_event(
            data={
                "fingerprint": ["group1"],
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert event.group is not None

        GroupOwner.objects.create(
            group=event.group,
            user_id=self.user.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": self.commit.id},
        )

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_id_or_slug": event.project.slug,
                "organization_id_or_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        commits = response.data["committers"][0]["commits"]
        assert len(commits) == 1
        assert "pullRequest" in commits[0]
        assert commits[0]["pullRequest"]["id"] == pull_request.key
        assert commits[0]["suspectCommitType"] == "via SCM integration"

    def test_endpoint_with_no_user_groupowner(self) -> None:
        """Test API endpoint returns commit author fallback for GroupOwner with user_id=None."""
        self.login_as(user=self.user)
        project = self.create_project()

        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago},
            project_id=project.id,
            default_event_type=EventType.DEFAULT,
        )

        # Create commit with external author and GroupOwner with user_id=None
        repo = self.create_repo(project=project, name="example/repo")
        commit_author = CommitAuthor.objects.create(
            organization_id=project.organization_id,
            name="External Dev",
            email="external@example.com",
        )
        commit = self.create_commit(project=project, repo=repo, author=commit_author)
        assert event.group is not None
        GroupOwner.objects.create(
            group_id=event.group.id,
            project=project,
            organization_id=project.organization_id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=None,  # No Sentry user mapping
            context={
                "commitId": commit.id,
                "suspectCommitStrategy": SuspectCommitStrategy.RELEASE_BASED,
            },
        )

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_id_or_slug": event.project.slug,
                "organization_id_or_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content

        # Should return commit author fallback
        author = response.data["committers"][0]["author"]
        assert author["email"] == "external@example.com"
        assert author["name"] == "External Dev"
        assert "username" not in author  # No Sentry user fields
        assert "id" not in author  # No Sentry user fields

        group_owner = GroupOwner.objects.get(
            group_id=event.group.id, type=GroupOwnerType.SUSPECT_COMMIT.value
        )
        assert "group_owner_id" in response.data["committers"][0]
        assert response.data["committers"][0]["group_owner_id"] == group_owner.id

    def test_release_based_suspect_commit_displayed(self) -> None:
        """Test that RELEASE_BASED suspect commits are displayed via the endpoint."""
        self.login_as(user=self.user)
        project = self.create_project()

        repo = self.create_repo(project=project, name="example/repo")
        release = self.create_release(project=project, version="v1.0")
        commit = self.create_commit(project=project, repo=repo)
        release.set_commits([{"id": commit.key, "repository": repo.name}])

        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago},
            project_id=project.id,
            default_event_type=EventType.DEFAULT,
        )
        assert event.group is not None

        GroupOwner.objects.create(
            group_id=event.group.id,
            project=project,
            organization_id=project.organization_id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=self.user.id,
            context={
                "commitId": commit.id,
                "suspectCommitStrategy": SuspectCommitStrategy.RELEASE_BASED,
            },
        )

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_id_or_slug": event.project.slug,
                "organization_id_or_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data["committers"]) == 1

        commits = response.data["committers"][0]["commits"]
        assert len(commits) == 1
        assert commits[0]["id"] == commit.key
        assert commits[0]["suspectCommitType"] == "via commit in release"
