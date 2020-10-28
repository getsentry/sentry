from __future__ import absolute_import

from sentry.utils.compat.mock import Mock, patch

from django.utils import timezone

from datetime import timedelta

from sentry.exceptions import HookValidationError
from sentry.models import (
    Commit,
    Deploy,
    Environment,
    ProjectOption,
    Release,
    ReleaseCommit,
    ReleaseHeadCommit,
    Repository,
    User,
)
from sentry.testutils import TestCase

from sentry_plugins.heroku.plugin import HerokuReleaseHook


class SetRefsTest(TestCase):
    """
    tests that when finish_release is called on a release hook,
    we try to get the previous commits based on the version ref
    and that we create `ReleaseHeadCommit`s for the version
    """

    @patch("sentry.tasks.commits.fetch_commits")
    def test_minimal(self, mock_fetch_commits):
        project = self.create_project()
        version = "bbee5b51f84611e4b14834363b8514c2"
        data_list = [
            {
                "id": "c7155651831549cf8a5e47889fce17eb",
                "message": "foo",
                "author_email": "jane@example.com",
            },
            {
                "id": "62de626b7c7cfb8e77efb4273b1a3df4123e6216",
                "message": "hello",
                "author_name": "Jess",
            },
            {
                "id": "58de626b7c7cfb8e77efb4273b1a3df4123e6345",
                "message": "bar",
                "author_name": "Joe^^",
            },
            {
                "id": "bbee5b51f84611e4b14834363b8514c2",
                "message": "blah",
                "author_email": "katie@example.com",
            },
        ]
        user = User.objects.create(email="stebe@sentry.io")
        repo = Repository.objects.create(
            organization_id=project.organization_id, name=project.name, provider="dummy"
        )
        ProjectOption.objects.set_value(key="heroku:repository", project=project, value=repo.name)
        for data in data_list:
            Commit.objects.create(
                key=data["id"], organization_id=self.project.organization_id, repository_id=repo.id
            )

        old_release = Release.objects.create(
            version="a" * 40,
            organization_id=project.organization_id,
            date_added=timezone.now() - timedelta(minutes=30),
        )
        old_release.add_project(project)

        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=old_release,
            commit=Commit.objects.get(key="c7155651831549cf8a5e47889fce17eb"),
            order=0,
        )
        ReleaseHeadCommit.objects.create(
            organization_id=project.organization_id,
            repository_id=repo.id,
            release=old_release,
            commit=Commit.objects.get(key="c7155651831549cf8a5e47889fce17eb"),
        )
        release_heads = ReleaseHeadCommit.objects.filter(
            organization_id=project.organization_id,
            repository_id=repo.id,
            commit=Commit.objects.get(key="bbee5b51f84611e4b14834363b8514c2"),
        )

        assert len(release_heads) == 0
        hook = HerokuReleaseHook(project)
        hook.finish_release(version=version, owner=user)

        release = Release.objects.get(projects=project, version=version)

        new_release_heads = ReleaseHeadCommit.objects.filter(
            organization_id=project.organization_id,
            repository_id=repo.id,
            release=release,
            commit=Commit.objects.get(key="bbee5b51f84611e4b14834363b8514c2"),
        )
        assert len(new_release_heads) == 1
        assert release.version == "bbee5b51f84611e4b14834363b8514c2"

        deploy = Deploy.objects.filter(
            organization_id=project.organization_id,
            release=release,
            environment_id=Environment.objects.get(
                organization_id=project.organization_id, name="production"
            ).id,
        )
        assert len(deploy) == 1

        mock_fetch_commits.apply_async.assert_called_with(
            kwargs={
                "release_id": release.id,
                "user_id": user.id,
                "refs": [{"commit": "bbee5b51f84611e4b14834363b8514c2", "repository": repo.name}],
                "prev_release_id": old_release.id,
            }
        )


class HookHandleTest(TestCase):
    def test_user_success(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        project = self.create_project(organization=organization)
        hook = HerokuReleaseHook(project)
        hook.set_refs = Mock()

        req = Mock()
        req.POST = {"head_long": "abcd123", "url": "http://example.com", "user": user.email}
        hook.handle(req)
        assert Release.objects.filter(version=req.POST["head_long"]).exists()
        assert hook.set_refs.call_count == 1

    def test_actor_email_success(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        project = self.create_project(organization=organization)
        hook = HerokuReleaseHook(project)
        hook.set_refs = Mock()

        req = Mock()
        req.POST = {
            "head_long": "v999",
            "url": "http://example.com",
            "actor": {"email": user.email},
        }
        hook.handle(req)
        assert Release.objects.filter(version=req.POST["head_long"]).exists()
        assert hook.set_refs.call_count == 1

    def test_email_mismatch(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        project = self.create_project(organization=organization)
        hook = HerokuReleaseHook(project)

        req = Mock()
        req.POST = {"head_long": "v999", "url": "http://example.com", "user": "wrong@example.com"}
        hook.handle(req)
        assert Release.objects.filter(version=req.POST["head_long"]).exists()

    def test_bad_version(self):
        project = self.create_project()
        user = self.create_user()
        hook = HerokuReleaseHook(project)

        req = Mock()
        req.POST = {"head_long": "", "url": "http://example.com", "user": user.email}
        with self.assertRaises(HookValidationError):
            hook.handle(req)
