from sentry.api.serializers import serialize
from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.group import GroupStatus
from sentry.models.pullrequest import PullRequest
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.activity import ActivityType
from sentry.users.models.user import User


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
        commit_data = result["commit"]
        assert commit_data["repository"]["name"] == "organization-bar"
        assert commit_data["message"] == "gemuse"

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

    def test_collapse_group_stats_in_activity_with_option(self):
        project = self.create_project(name="random-test")
        group = self.create_group(project)
        group_2 = self.create_group(project)
        user = self.create_user()
        release = self.create_release(project=project, user=user)
        release.date_released = None
        release.save()

        Activity.objects.create(
            project_id=project.id,
            group=group,
            type=ActivityType.UNMERGE_DESTINATION.value,
            ident=group.id,
            user_id=user.id,
            data={"destination_id": group_2.id, "source_id": group.id, "fingerprints": ["aabbcc"]},
        )

        act = Activity.objects.get(type=ActivityType.UNMERGE_DESTINATION.value)
        serialized = serialize(act)

        assert "firstSeen" not in serialized["data"]["source"]

    def test_get_activities_for_group_proxy_user(self):
        project = self.create_project(name="test_activities_group")
        group = self.create_group(project)
        user = self.create_user()
        data = serialize(
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.NOTE,
                data={"text": "A human sent this message"},
                user=user,
            )
        )
        # Regular users, have a new empty key
        assert data["user"]["name"] == user.username
        assert data["sentry_app"] is None

        sentry_app = self.create_sentry_app(name="test_sentry_app")
        default_avatar = self.create_sentry_app_avatar(sentry_app=sentry_app)
        upload_avatar = self.create_sentry_app_avatar(sentry_app=sentry_app)
        with assume_test_silo_mode(SiloMode.CONTROL):
            proxy_user = User.objects.get(id=sentry_app.proxy_user_id)
            upload_avatar.avatar_type = 1  # an upload
            upload_avatar.color = True  # a logo
            upload_avatar.save()

        data = serialize(
            Activity.objects.create_group_activity(
                group=group,
                type=ActivityType.NOTE,
                data={"text": "My app sent this message"},
                user=proxy_user,
            )
        )
        assert data["user"]["name"] == proxy_user.email
        assert data["sentry_app"]["name"] == sentry_app.name
        assert {
            "avatarType": "default",
            "avatarUuid": default_avatar.ident,
            "avatarUrl": f"http://testserver/sentry-app-avatar/{default_avatar.ident}/",
            "color": False,
            "photoType": "icon",
        } in data["sentry_app"]["avatars"]
        assert {
            "avatarType": "upload",
            "avatarUuid": upload_avatar.ident,
            "avatarUrl": f"http://testserver/sentry-app-avatar/{upload_avatar.ident}/",
            "color": True,
            "photoType": "logo",
        } in data["sentry_app"]["avatars"]
