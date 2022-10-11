import copy

from django.urls import reverse

from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.pullrequest import PullRequest
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.testutils import APITestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data


# TODO(dcramer): These tests rely too much on implicit fixtures
@apply_feature_flag_on_cls("organizations:release-committer-assignees")
@region_silo_test
class EventCommittersTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()

        release = self.create_release(project, self.user)
        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={
                "fingerprint": ["group1"],
                "timestamp": min_ago,
                "release": release.version,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
            },
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_slug": event.project.slug,
                "organization_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data["committers"]) == 1
        assert response.data["committers"][0]["author"]["username"] == "admin@localhost"
        assert len(response.data["committers"][0]["commits"]) == 1
        assert (
            response.data["committers"][0]["commits"][0]["message"] == "placeholder commit message"
        )

    def test_no_group(self):
        self.login_as(user=self.user)

        project = self.create_project()

        min_ago = iso_format(before_now(minutes=1))
        event_data = load_data("transaction")
        event_data["start_timestamp"] = min_ago
        event_data["timestamp"] = min_ago

        event = self.store_event(data=event_data, project_id=project.id)

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_slug": event.project.slug,
                "organization_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 404, response.content
        assert response.data["detail"] == "Issue not found"

    def test_no_release(self):
        self.login_as(user=self.user)

        project = self.create_project()

        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago}, project_id=project.id
        )

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_slug": event.project.slug,
                "organization_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 404, response.content
        assert response.data["detail"] == "Release not found"

    def test_null_stacktrace(self):
        self.login_as(user=self.user)

        project = self.create_project()

        release = self.create_release(project, self.user)

        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={
                "fingerprint": ["group1"],
                "environment": "production",
                "type": "default",
                "exception": {
                    "values": [
                        {
                            "type": "ValueError",
                            "value": "My exception value",
                            "module": "__builtins__",
                            "stacktrace": None,
                        }
                    ]
                },
                "tags": [["environment", "production"], ["sentry:release", release.version]],
                "release": release.version,
                "timestamp": min_ago,
            },
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_slug": event.project.slug,
                "organization_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content

    def test_with_release_committers(self):
        self.login_as(user=self.user)
        release = self.create_release(self.project, version="1.0.0")

        event = self.store_event(
            data={
                "fingerprint": ["group1"],
                "timestamp": iso_format(before_now(minutes=1)),
                "release": release.version,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
            },
            project_id=self.project.id,
        )
        repo = Repository.objects.create(
            organization_id=self.project.organization_id, name=self.project.name
        )
        user2 = self.create_user()
        self.create_member(organization=self.organization, user=user2)
        author1 = self.create_commit_author(project=self.project, user=user2)
        self.create_commit_author(project=self.project, user=user2)
        # External author
        author2 = CommitAuthor.objects.create(
            external_id="github:santry",
            organization_id=self.project.organization_id,
            email="santry@example.com",
            name="santry",
        )
        commit1 = Commit.objects.create(
            organization_id=self.project.organization_id,
            repository_id=repo.id,
            key="a" * 40,
            author=author1,
        )
        commit2 = Commit.objects.create(
            organization_id=self.project.organization_id,
            repository_id=repo.id,
            key="b" * 40,
            author=author2,
        )
        ReleaseCommit.objects.create(
            organization_id=self.project.organization_id,
            release=release,
            commit=commit1,
            order=2,
        )
        ReleaseCommit.objects.create(
            organization_id=self.project.organization_id,
            release=release,
            commit=commit2,
            order=3,
        )

        url = reverse(
            "sentry-api-0-event-file-committers",
            kwargs={
                "event_id": event.event_id,
                "project_slug": event.project.slug,
                "organization_slug": event.project.organization.slug,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data["committers"]) == 0

        releaseCommitters = response.data["releaseCommitters"]
        assert len(releaseCommitters) == 1
        assert releaseCommitters[0]["author"]["id"] == str(user2.id)

        commits = releaseCommitters[0]["commits"]
        assert len(commits) == 1
        assert commits[0]["id"] == "a" * 40

        assert releaseCommitters[0]["release"]["id"] == release.id

    def test_with_commit_context_feature_flag(self):
        with self.feature({"organizations:commit-context": True}):
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
                    "timestamp": iso_format(before_now(minutes=1)),
                    "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                },
                project_id=self.project.id,
            )

            GroupOwner.objects.create(
                group=event.group,
                user=self.user,
                project=self.project,
                organization=self.organization,
                type=GroupOwnerType.SUSPECT_COMMIT.value,
                context={"commitId": self.commit.id},
            )

            url = reverse(
                "sentry-api-0-event-file-committers",
                kwargs={
                    "event_id": event.event_id,
                    "project_slug": event.project.slug,
                    "organization_slug": event.project.organization.slug,
                },
            )

            response = self.client.get(url, format="json")
            assert response.status_code == 200, response.content
            assert len(response.data["committers"]) == 1
            assert response.data["committers"][0]["author"]["username"] == "admin@localhost"
            assert len(response.data["committers"][0]["commits"]) == 1
            assert (
                response.data["committers"][0]["commits"][0]["message"]
                == "placeholder commit message"
            )

    def test_with_commit_context_pull_request(self):
        with self.feature({"organizations:commit-context": True}):
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
                    "timestamp": iso_format(before_now(minutes=1)),
                    "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                },
                project_id=self.project.id,
            )

            GroupOwner.objects.create(
                group=event.group,
                user=self.user,
                project=self.project,
                organization=self.organization,
                type=GroupOwnerType.SUSPECT_COMMIT.value,
                context={"commitId": self.commit.id},
            )

            url = reverse(
                "sentry-api-0-event-file-committers",
                kwargs={
                    "event_id": event.event_id,
                    "project_slug": event.project.slug,
                    "organization_slug": event.project.organization.slug,
                },
            )

            response = self.client.get(url, format="json")
            assert response.status_code == 200, response.content
            assert len(response.data["committers"][0]["commits"]) == 1
            assert "pullRequest" in response.data["committers"][0]["commits"][0]
            assert (
                response.data["committers"][0]["commits"][0]["pullRequest"]["id"]
                == pull_request.key
            )
