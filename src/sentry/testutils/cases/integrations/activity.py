from __future__ import annotations

from django.utils import timezone

from sentry.models import Commit, CommitAuthor, Deploy, Release, ReleaseCommit, UserEmail

from ..base import TestCase


class ActivityTestCase(TestCase):
    def another_user(self, email_string, team=None, alt_email_string=None):
        user = self.create_user(email_string)
        if alt_email_string:
            UserEmail.objects.create(email=alt_email_string, user=user)

            assert UserEmail.objects.filter(user=user, email=alt_email_string).update(
                is_verified=True
            )

        assert UserEmail.objects.filter(user=user, email=user.email).update(is_verified=True)

        self.create_member(user=user, organization=self.org, teams=[team] if team else None)

        return user

    def another_commit(self, order, name, user, repository, alt_email_string=None):
        commit = Commit.objects.create(
            key=name * 40,
            repository_id=repository.id,
            organization_id=self.org.id,
            author=CommitAuthor.objects.create(
                organization_id=self.org.id,
                name=user.name,
                email=alt_email_string or user.email,
            ),
        )
        ReleaseCommit.objects.create(
            organization_id=self.org.id,
            release=self.release,
            commit=commit,
            order=order,
        )

        return commit

    def another_release(self, name):
        release = Release.objects.create(
            version=name * 40,
            organization_id=self.project.organization_id,
            date_released=timezone.now(),
        )
        release.add_project(self.project)
        release.add_project(self.project2)
        deploy = Deploy.objects.create(
            release=release, organization_id=self.org.id, environment_id=self.environment.id
        )

        return release, deploy
