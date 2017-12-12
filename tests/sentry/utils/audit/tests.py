from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser

from sentry.models import ApiKey, AuditLogEntryEvent, DeletedOrganization, DeletedTeam, DeletedProject
from sentry.testutils import TestCase
from sentry.utils.audit import create_audit_entry


class FakeHttpRequest(object):
    def __init__(self, user):
        self.user = user
        self.META = {'REMOTE_ADDR': '127.0.0.1'}


class CreateAuditEntryTest(TestCase):

    def setUp(self):
        self.user = self.create_user()
        self.req = FakeHttpRequest(self.user)
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(team=self.team, platform='java')

    def assert_no_delete_log_created(self):
        assert not DeletedOrganization.objects.filter(slug=self.org.slug).exists()
        assert not DeletedTeam.objects.filter(slug=self.team.slug).exists()
        assert not DeletedProject.objects.filter(slug=self.project.slug).exists()

    def test_audit_entry_api(self):
        org = self.create_organization()
        apikey = ApiKey.objects.create(
            organization=org,
            allowed_origins='*',
        )

        req = FakeHttpRequest(AnonymousUser())
        req.auth = apikey

        entry = create_audit_entry(req)
        assert entry.actor_key == apikey
        assert entry.actor is None
        assert entry.ip_address == req.META['REMOTE_ADDR']

        self.assert_no_delete_log_created()

    def test_audit_entry_frontend(self):
        req = FakeHttpRequest(self.create_user())
        entry = create_audit_entry(req)

        assert entry.actor == req.user
        assert entry.actor_key is None
        assert entry.ip_address == req.META['REMOTE_ADDR']

        self.assert_no_delete_log_created()

    def test_audit_entry_org_delete_log(self):
        entry = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.org.id,
            event=AuditLogEntryEvent.ORG_REMOVE,
            data=self.org.get_audit_log_data(),
        )

        assert entry.actor == self.user
        assert entry.target_object == self.org.id
        assert entry.event == AuditLogEntryEvent.ORG_REMOVE

        deleted_org = DeletedOrganization.objects.get(slug=self.org.slug)
        self.assert_valid_deleted_log(deleted_org, self.org)

    def test_audit_entry_team_delete_log(self):
        entry = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.team.id,
            event=AuditLogEntryEvent.TEAM_REMOVE,
            data=self.team.get_audit_log_data(),
        )

        assert entry.actor == self.user
        assert entry.target_object == self.team.id
        assert entry.event == AuditLogEntryEvent.TEAM_REMOVE

        deleted_team = DeletedTeam.objects.get(slug=self.team.slug)
        self.assert_valid_deleted_log(deleted_team, self.team)

    def test_audit_entry_project_delete_log(self):
        entry = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.project.id,
            event=AuditLogEntryEvent.PROJECT_REMOVE,
            data=self.project.get_audit_log_data(),
        )

        assert entry.actor == self.user
        assert entry.target_object == self.project.id
        assert entry.event == AuditLogEntryEvent.PROJECT_REMOVE

        deleted_project = DeletedProject.objects.get(slug=self.project.slug)
        self.assert_valid_deleted_log(deleted_project, self.project)
        assert deleted_project.platform == self.project.platform
