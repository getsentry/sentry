from sentry.api.serializers import serialize
from sentry.issues.action_log.types import GroupActionType, GroupActorType
from sentry.models.commit import Commit
from sentry.models.group import GroupStatus
from sentry.models.pullrequest import PullRequest
from sentry.testutils.cases import TestCase


class GroupActionLogEntrySerializerTestCase(TestCase):
    def test_pull_request_entry(self) -> None:
        self.org = self.create_organization(name="Rowdy Tiger")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        repo = self.create_repo(self.project, name="organization-bar")
        pr = PullRequest.objects.create(
            organization_id=self.org.id,
            repository_id=repo.id,
            key=5,
            title="aaaa",
            message="kartoffel",
        )

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.RESOLVED_IN_PULL_REQUEST,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"pull_request": pr.id},
        )

        result = serialize([entry], user)[0]["data"]
        pull_request = result["pullRequest"]
        assert pull_request["repository"]["name"] == "organization-bar"
        assert pull_request["message"] == "kartoffel"

    def test_pull_request_closed_entry(self) -> None:
        self.org = self.create_organization(name="Rowdy Tiger")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        repo = self.create_repo(self.project, name="organization-bar")
        pr = PullRequest.objects.create(
            organization_id=self.org.id,
            repository_id=repo.id,
            key=5,
            title="aaaa",
            message="kartoffel",
        )

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.PULL_REQUEST_CLOSED,
            data={"pull_request": pr.id},
        )

        result = serialize([entry], user)[0]
        assert result["type"] == "pull_request_closed"
        pull_request = result["data"]["pullRequest"]
        assert pull_request["repository"]["name"] == "organization-bar"
        assert pull_request["message"] == "kartoffel"

    def test_commit_entry(self) -> None:
        self.org = self.create_organization(name="Rowdy Tiger")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        repo = self.create_repo(self.project, name="organization-bar")

        commit = Commit.objects.create(
            organization_id=self.org.id, repository_id=repo.id, key="11111111", message="gemuse"
        )

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.SET_RESOLVED_IN_COMMIT,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"commit": commit.id},
        )

        result = serialize([entry], user)[0]["data"]
        commit_data = result["commit"]
        assert commit_data["repository"]["name"] == "organization-bar"
        assert commit_data["message"] == "gemuse"

    def test_referenced_in_commit_entry(self) -> None:
        self.org = self.create_organization(name="Rowdy Tiger")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        repo = self.create_repo(self.project, name="organization-bar")

        commit = Commit.objects.create(
            organization_id=self.org.id, repository_id=repo.id, key="11111111", message="gemuse"
        )

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.REFERENCED_IN_COMMIT,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"commit": commit.id},
        )

        result = serialize([entry], user)[0]
        assert result["type"] == "referenced_in_commit"
        commit_data = result["data"]["commit"]
        assert commit_data["repository"]["name"] == "organization-bar"
        assert commit_data["message"] == "gemuse"

    def test_serialize_set_resolve_in_commit_entry_with_release(self) -> None:
        project = self.create_project(name="test_throwaway")
        group = self.create_group(project)
        user = self.create_user()
        release = self.create_release(project=project, user=user)
        release.save()
        commit = Commit.objects.filter(releasecommit__release_id=release.id).get()

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.SET_RESOLVED_IN_COMMIT,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"commit": commit.id},
        )

        serialized = serialize(entry)

        assert len(serialized["data"]["commit"]["releases"]) == 1

    def test_serialize_set_resolve_in_commit_entry_with_no_releases(self) -> None:
        self.org = self.create_organization(name="komal-test")
        project = self.create_project(name="random-proj")
        user = self.create_user()
        repo = self.create_repo(self.project, name="idk-repo")
        group = self.create_group(project)

        commit = Commit.objects.create(organization_id=self.org.id, repository_id=repo.id)

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.SET_RESOLVED_IN_COMMIT,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"commit": commit.id},
        )

        serialized = serialize(entry)

        assert len(serialized["data"]["commit"]["releases"]) == 0
        assert not Commit.objects.filter(releasecommit__id=commit.id).exists()

    def test_serialize_set_resolve_in_commit_entry_with_release_not_deployed(self) -> None:
        project = self.create_project(name="random-test")
        group = self.create_group(project)
        user = self.create_user()
        release = self.create_release(project=project, user=user)
        release.date_released = None
        release.save()
        commit = Commit.objects.filter(releasecommit__release_id=release.id).get()

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.SET_RESOLVED_IN_COMMIT,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"commit": commit.id},
        )

        serialized = serialize(entry)

        assert len(serialized["data"]["commit"]["releases"]) == 1
