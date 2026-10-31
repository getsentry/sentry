from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.deploy import Deploy
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.releaseheadcommit import ReleaseHeadCommit
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class DeployNotifyTest(TestCase):
    def test_notify_if_ready_long_release(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        release = Release.objects.create(version="a" * 200, organization=org)
        release.add_project(project)
        env = Environment.objects.create(name="production", organization_id=org.id)
        deploy = Deploy.objects.create(
            release=release, organization_id=org.id, environment_id=env.id
        )
        Deploy.notify_if_ready(deploy.id)

        # make sure activity has been created
        record = Activity.objects.get(type=ActivityType.DEPLOY.value, project=project)
        assert record.ident is not None
        assert release.version.startswith(record.ident)

    def test_already_notified(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        release = Release.objects.create(version="a" * 40, organization=org)
        release.add_project(project)
        env = Environment.objects.create(name="production", organization_id=org.id)

        deploy = Deploy.objects.create(
            release=release, organization_id=org.id, environment_id=env.id, notified=True
        )

        Deploy.notify_if_ready(deploy.id)

        # make sure no activity has been created
        assert not Activity.objects.filter(
            type=ActivityType.DEPLOY.value, project=project, ident=release.version
        ).exists()

    def test_no_commits_no_head_commits(self) -> None:
        # case where there are not commits, but also no head commit,
        # so we shouldn't bother waiting to notify
        org = self.create_organization()
        project = self.create_project(organization=org)
        release = Release.objects.create(version="a" * 40, organization=org)
        release.add_project(project)
        env = Environment.objects.create(name="production", organization_id=org.id)

        deploy = Deploy.objects.create(
            release=release, organization_id=org.id, environment_id=env.id
        )

        Deploy.notify_if_ready(deploy.id)

        # make sure activity has been created
        activity = Activity.objects.get(
            type=ActivityType.DEPLOY.value, project=project, ident=release.version
        )
        assert activity.data["deploy_id"] == deploy.id
        assert Deploy.objects.get(id=deploy.id).notified is True

    def test_head_commits_fetch_not_complete(self) -> None:
        # case where there are not commits, but there are head
        # commits, indicating we should wait to notify
        org = self.create_organization()
        project = self.create_project(organization=org)
        release = Release.objects.create(version="a" * 40, organization=org)
        release.add_project(project)
        ReleaseHeadCommit.objects.create(
            release=release,
            organization_id=org.id,
            repository_id=5,
            commit=Commit.objects.create(key="b" * 40, repository_id=5, organization_id=org.id),
        )
        env = Environment.objects.create(name="production", organization_id=org.id)

        deploy = Deploy.objects.create(
            release=release, organization_id=org.id, environment_id=env.id
        )

        Deploy.notify_if_ready(deploy.id)

        # make sure activity has been created
        assert not Activity.objects.filter(
            type=ActivityType.DEPLOY.value, project=project, ident=release.version
        ).exists()
        assert Deploy.objects.get(id=deploy.id).notified is False

    def test_no_commits_fetch_complete(self) -> None:
        # case where they've created a deploy and
        # we've tried to fetch commits, but there
        # weren't any
        org = self.create_organization()
        project = self.create_project(organization=org)
        release = Release.objects.create(version="a" * 40, organization=org)
        release.add_project(project)
        env = Environment.objects.create(name="production", organization_id=org.id)

        deploy = Deploy.objects.create(
            release=release, organization_id=org.id, environment_id=env.id
        )

        Deploy.notify_if_ready(deploy.id, fetch_complete=True)

        # make sure activity has been created
        activity = Activity.objects.get(
            type=ActivityType.DEPLOY.value, project=project, ident=release.version
        )
        assert activity.data["deploy_id"] == deploy.id
        assert Deploy.objects.get(id=deploy.id).notified is True

    def test_duplicate_release_environment_notifies_once(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        release = self.create_release(project=project, version="a" * 40)
        env = self.create_environment(project=project, name="production")

        first = Deploy.objects.create(
            release=release, organization_id=org.id, environment_id=env.id
        )
        Deploy.notify_if_ready(first.id)

        activity = Activity.objects.get(
            type=ActivityType.DEPLOY.value, project=project, ident=release.version
        )
        assert activity.data["deploy_id"] == first.id
        assert Deploy.objects.get(id=first.id).notified is True

        duplicate = Deploy.objects.create(
            release=release, organization_id=org.id, environment_id=env.id
        )
        Deploy.notify_if_ready(duplicate.id)

        assert (
            Activity.objects.filter(
                type=ActivityType.DEPLOY.value, project=project, ident=release.version
            ).count()
            == 1
        )
        assert Deploy.objects.get(id=duplicate.id).notified is True
        assert Deploy.objects.filter(release=release, environment_id=env.id).count() == 2

    def test_same_release_different_environment_notifies(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        release = self.create_release(project=project, version="a" * 40)
        production = self.create_environment(project=project, name="production")
        staging = self.create_environment(project=project, name="staging")

        prod_deploy = Deploy.objects.create(
            release=release, organization_id=org.id, environment_id=production.id
        )
        Deploy.notify_if_ready(prod_deploy.id)

        staging_deploy = Deploy.objects.create(
            release=release, organization_id=org.id, environment_id=staging.id
        )
        Deploy.notify_if_ready(staging_deploy.id)

        activities = Activity.objects.filter(
            type=ActivityType.DEPLOY.value, project=project, ident=release.version
        )
        assert activities.count() == 2
        assert {activity.data["environment"] for activity in activities} == {
            "production",
            "staging",
        }
        assert Deploy.objects.get(id=prod_deploy.id).notified is True
        assert Deploy.objects.get(id=staging_deploy.id).notified is True

    def test_waiting_on_commits_then_duplicate_does_not_notify_again(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        release = self.create_release(project=project, version="a" * 40)
        ReleaseHeadCommit.objects.create(
            release=release,
            organization_id=org.id,
            repository_id=5,
            commit=Commit.objects.create(key="b" * 40, repository_id=5, organization_id=org.id),
        )
        env = self.create_environment(project=project, name="production")

        deploy = Deploy.objects.create(
            release=release, organization_id=org.id, environment_id=env.id
        )
        Deploy.notify_if_ready(deploy.id)

        assert not Activity.objects.filter(
            type=ActivityType.DEPLOY.value, project=project, ident=release.version
        ).exists()
        assert Deploy.objects.get(id=deploy.id).notified is False

        Deploy.notify_if_ready(deploy.id, fetch_complete=True)

        activity = Activity.objects.get(
            type=ActivityType.DEPLOY.value, project=project, ident=release.version
        )
        assert activity.data["deploy_id"] == deploy.id
        assert Deploy.objects.get(id=deploy.id).notified is True

        duplicate = Deploy.objects.create(
            release=release, organization_id=org.id, environment_id=env.id
        )
        Deploy.notify_if_ready(duplicate.id, fetch_complete=True)

        assert (
            Activity.objects.filter(
                type=ActivityType.DEPLOY.value, project=project, ident=release.version
            ).count()
            == 1
        )
        assert Deploy.objects.get(id=duplicate.id).notified is True
