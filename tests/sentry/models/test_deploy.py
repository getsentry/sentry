from __future__ import absolute_import

from sentry.models import Activity, Commit, Deploy, Environment, Release, ReleaseHeadCommit

from sentry.testutils import TestCase


class DeployNotifyTest(TestCase):
    def test_notify_if_ready_long_release(self):
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
        record = Activity.objects.get(type=Activity.DEPLOY, project=project)
        assert release.version.startswith(record.ident)

    def test_already_notified(self):
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
            type=Activity.DEPLOY, project=project, ident=release.version
        ).exists()

    def test_no_commits_no_head_commits(self):
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
        assert Activity.objects.filter(
            type=Activity.DEPLOY, project=project, ident=release.version
        ).exists()
        assert (
            Activity.objects.get(type=Activity.DEPLOY, project=project, ident=release.version).data[
                "deploy_id"
            ]
            == deploy.id
        )
        assert Deploy.objects.get(id=deploy.id).notified is True

    def test_head_commits_fetch_not_complete(self):
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
            type=Activity.DEPLOY, project=project, ident=release.version
        ).exists()
        assert Deploy.objects.get(id=deploy.id).notified is False

    def test_no_commits_fetch_complete(self):
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
        assert Activity.objects.filter(
            type=Activity.DEPLOY, project=project, ident=release.version
        ).exists()
        assert (
            Activity.objects.get(type=Activity.DEPLOY, project=project, ident=release.version).data[
                "deploy_id"
            ]
            == deploy.id
        )
        assert Deploy.objects.get(id=deploy.id).notified is True
