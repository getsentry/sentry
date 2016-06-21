from __future__ import absolute_import

from django.utils import timezone

from sentry.models import GroupStatus
from sentry.testutils import AcceptanceTestCase


class ProjectIssuesTest(AcceptanceTestCase):
    # TODO(dcramer): abstract fixtures into a basic set that is present for
    # all acceptance tests
    def test_not_setup(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(
            organization=org, team=team, first_event=None)

        self.login_as(user)

        # TODO(dcramer): we should add basic assertions around "i wanted this
        # URL but was sent somewhere else"
        self.browser.get(self.route(
            '/{}/{}/', org.slug, project.slug
        ))
        self.wait_until('.awaiting-events')
        self.snapshot('project issues not configured')

    def test_with_issues(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(
            organization=org, team=team, first_event=timezone.now())
        self.create_group(
            project=project,
            message='Foo bar',
            status=GroupStatus.UNRESOLVED,
        )

        self.login_as(user)

        # TODO(dcramer): we should add basic assertions around "i wanted this
        # URL but was sent somewhere else"
        self.browser.get(self.route(
            '/{}/{}/', org.slug, project.slug
        ))
        self.wait_until('.group-list')
        self.snapshot('project issues with issues')

    def test_with_no_issues(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(
            organization=org, team=team, first_event=timezone.now())

        self.login_as(user)

        # TODO(dcramer): we should add basic assertions around "i wanted this
        # URL but was sent somewhere else"
        self.browser.get(self.route(
            '/{}/{}/', org.slug, project.slug
        ))
        self.wait_until('.empty-stream')
        self.snapshot('project issues without issues')
