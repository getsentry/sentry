from sentry.api.serializers import serialize
from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.group import GroupStatus
from sentry.models.pullrequest import PullRequest
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType


@region_silo_test
class GroupActivityTestCase(TestCase):
    def test_pr_activity(self):
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

        activity = Activity.objects.create(
            project_id=group.project_id,
            group=group,
            type=ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value,
            ident=pr.id,
            user_id=user.id,
            data={"pull_request": pr.id},
        )

        result = serialize([activity], user)[0]["data"]
        pull_request = result["pullRequest"]
        assert pull_request["repository"]["name"] == "organization-bar"
        assert pull_request["message"] == "kartoffel"

    def test_commit_activity(self):
        self.org = self.create_organization(name="Rowdy Tiger")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        repo = self.create_repo(self.project, name="organization-bar")

        commit = Commit.objects.create(
            organization_id=self.org.id, repository_id=repo.id, key="11111111", message="gemuse"
        )

        activity = Activity.objects.create(
            project_id=group.project_id,
            group=group,
            type=ActivityType.SET_RESOLVED_IN_COMMIT.value,
            ident=commit.id,
            user_id=user.id,
            data={"commit": commit.id},
        )

        result = serialize([activity], user)[0]["data"]
        commit = result["commit"]
        assert commit["repository"]["name"] == "organization-bar"
        assert commit["message"] == "gemuse"

    def test_serialize_set_resolve_in_commit_activity_with_release(self):
        project = self.create_project(name="test_throwaway")
        group = self.create_group(project)
        user = self.create_user()
        release = self.create_release(project=project, user=user)
        release.save()
        commit = Commit.objects.filter(releasecommit__release_id=release.id).get()

        Activity.objects.create(
            project_id=project.id,
            group=group,
            type=ActivityType.SET_RESOLVED_IN_COMMIT.value,
            ident=commit.id,
            user_id=user.id,
            data={"commit": commit.id},
        )

        act = Activity.objects.get(type=ActivityType.SET_RESOLVED_IN_COMMIT.value)
        serialized = serialize(act)

        assert len(serialized["data"]["commit"]["releases"]) == 1

    def test_serialize_set_resolve_in_commit_activity_with_no_releases(self):
        self.org = self.create_organization(name="komal-test")
        project = self.create_project(name="random-proj")
        user = self.create_user()
        repo = self.create_repo(self.project, name="idk-repo")
        group = self.create_group(project)

        commit = Commit.objects.create(organization_id=self.org.id, repository_id=repo.id)

        Activity.objects.create(
            project_id=project.id,
            group=group,
            type=ActivityType.SET_RESOLVED_IN_COMMIT.value,
            ident=commit.id,
            user_id=user.id,
            data={"commit": commit.id},
        )

        act = Activity.objects.get(type=ActivityType.SET_RESOLVED_IN_COMMIT.value)
        serialized = serialize(act)

        assert len(serialized["data"]["commit"]["releases"]) == 0
        assert not Commit.objects.filter(releasecommit__id=commit.id).exists()

    def test_serialize_set_resolve_in_commit_activity_with_release_not_deployed(self):
        project = self.create_project(name="random-test")
        group = self.create_group(project)
        user = self.create_user()
        release = self.create_release(project=project, user=user)
        release.date_released = None
        release.save()
        commit = Commit.objects.filter(releasecommit__release_id=release.id).get()

        Activity.objects.create(
            project_id=project.id,
            group=group,
            type=ActivityType.SET_RESOLVED_IN_COMMIT.value,
            ident=commit.id,
            user_id=user.id,
            data={"commit": commit.id},
        )

        act = Activity.objects.get(type=ActivityType.SET_RESOLVED_IN_COMMIT.value)
        serialized = serialize(act)

        assert len(serialized["data"]["commit"]["releases"]) == 1
