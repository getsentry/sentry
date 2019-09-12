from __future__ import absolute_import

from sentry.incidents.models import IncidentSuspectCommit
from sentry.models.commit import Commit
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.signals import release_commits_updated
from sentry.testutils import TestCase


class HandleReleaseCommitsUpdatedTest(TestCase):
    def test(self):
        release = self.create_release(project=self.project, version="something")
        self.repo = Repository.objects.create(
            organization_id=self.organization.id, name=self.organization.id
        )
        release.set_commits(
            [
                {
                    "id": "a" * 40,
                    "repository": self.repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                }
            ]
        )
        commit = Commit.objects.get(releasecommit__release=release)

        incident = self.create_incident()
        ReleaseCommit.objects.filter(release=release).delete()
        IncidentSuspectCommit.objects.create(incident=incident, commit=commit, order=1)
        with self.tasks():
            release_commits_updated.send_robust(
                release=release,
                removed_commit_ids=set([commit.id]),
                added_commit_ids=set([]),
                sender=Release,
            )
            assert not IncidentSuspectCommit.objects.filter(incident=incident).exists()
