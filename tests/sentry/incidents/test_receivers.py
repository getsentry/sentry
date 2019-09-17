from __future__ import absolute_import

from sentry.incidents.models import IncidentSuspectCommit
from sentry.models.commit import Commit
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.signals import release_commits_updated
from sentry.snuba.models import QuerySubscription
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


class AddProjectToIncludeAllRulesTest(TestCase):
    def test_include_all_projects_enabled(self):
        alert_rule = self.create_alert_rule(include_all_projects=True)
        new_project = self.create_project()
        assert QuerySubscription.objects.filter(
            project=new_project, alert_rules=alert_rule
        ).exists()

    def test_include_all_projects_disabled(self):
        alert_rule = self.create_alert_rule(include_all_projects=False)
        new_project = self.create_project()
        assert not QuerySubscription.objects.filter(
            project=new_project, alert_rules=alert_rule
        ).exists()

    def test_update_noop(self):
        new_project = self.create_project()
        alert_rule = self.create_alert_rule(
            include_all_projects=True, excluded_projects=[new_project]
        )
        new_project.update(name="hi")
        assert not QuerySubscription.objects.filter(
            project=new_project, alert_rules=alert_rule
        ).exists()
