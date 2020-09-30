from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser

from sentry.models import (
    ApiKey,
    AuditLogEntryEvent,
    DeletedOrganization,
    DeletedTeam,
    DeletedProject,
    Organization,
    OrganizationStatus,
)
from sentry.testutils import TestCase
from sentry.utils.audit import create_audit_entry

username = "hello" * 20


class FakeHttpRequest(object):
    def __init__(self, user):
        self.user = user
        self.META = {"REMOTE_ADDR": "127.0.0.1"}


class CreateAuditEntryTest(TestCase):
    def setUp(self):
        self.user = self.create_user(username=username)
        self.req = FakeHttpRequest(self.user)
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(teams=[self.team], platform="java")

    def assert_no_delete_log_created(self):
        assert not DeletedOrganization.objects.filter(slug=self.org.slug).exists()
        assert not DeletedTeam.objects.filter(slug=self.team.slug).exists()
        assert not DeletedProject.objects.filter(slug=self.project.slug).exists()

    def test_audit_entry_api(self):
        org = self.create_organization()
        apikey = ApiKey.objects.create(organization=org, allowed_origins="*")

        req = FakeHttpRequest(AnonymousUser())
        req.auth = apikey

        entry = create_audit_entry(req)
        assert entry.actor_key == apikey
        assert entry.actor is None
        assert entry.ip_address == req.META["REMOTE_ADDR"]

        self.assert_no_delete_log_created()

    def test_audit_entry_frontend(self):
        req = FakeHttpRequest(self.create_user())
        entry = create_audit_entry(req)

        assert entry.actor == req.user
        assert entry.actor_key is None
        assert entry.ip_address == req.META["REMOTE_ADDR"]

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
        assert entry.actor_label == username[:64]  # needs trimming
        assert entry.target_object == self.org.id
        assert entry.event == AuditLogEntryEvent.ORG_REMOVE

        deleted_org = DeletedOrganization.objects.get(slug=self.org.slug)
        self.assert_valid_deleted_log(deleted_org, self.org)

    def test_audit_entry_org_restore_log(self):
        Organization.objects.filter(id=self.organization.id).update(
            status=OrganizationStatus.PENDING_DELETION
        )

        org = Organization.objects.get(id=self.organization.id)

        Organization.objects.filter(id=self.organization.id).update(
            status=OrganizationStatus.DELETION_IN_PROGRESS
        )

        org2 = Organization.objects.get(id=self.organization.id)

        Organization.objects.filter(id=self.organization.id).update(
            status=OrganizationStatus.VISIBLE
        )

        org3 = Organization.objects.get(id=self.organization.id)

        orgs = [org, org2, org3]

        entry = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.org.id,
            event=AuditLogEntryEvent.ORG_RESTORE,
            data=self.org.get_audit_log_data(),
        )

        entry2 = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.org.id,
            event=AuditLogEntryEvent.ORG_EDIT,
            data=self.org.get_audit_log_data(),
        )

        for i in orgs:
            if (
                i.status == OrganizationStatus.PENDING_DELETION
                or i.status == OrganizationStatus.DELETION_IN_PROGRESS
            ):
                assert i.status != OrganizationStatus.VISIBLE
                assert ("restored") in entry.get_note()
                assert entry.actor == self.user
                assert entry.target_object == self.org.id
                assert entry.event == AuditLogEntryEvent.ORG_RESTORE
            else:
                assert i.status == OrganizationStatus.VISIBLE
                assert ("edited") in entry2.get_note()
                assert entry2.actor == self.user
                assert entry2.target_object == self.org.id
                assert entry2.event == AuditLogEntryEvent.ORG_EDIT

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

    def test_audit_entry_integration_log(self):
        project = self.create_project()
        self.login_as(user=self.user)

        entry = create_audit_entry(
            request=self.req,
            organization=self.project.organization,
            target_object=self.project.id,
            event=AuditLogEntryEvent.INTEGRATION_ADD,
            data={"integration": "webhooks", "project": project.slug},
        )

        assert ("enabled") in entry.get_note()
        assert entry.actor == self.user
        assert entry.target_object == self.project.id
        assert entry.event == AuditLogEntryEvent.INTEGRATION_ADD

        entry2 = create_audit_entry(
            request=self.req,
            organization=self.project.organization,
            target_object=self.project.id,
            event=AuditLogEntryEvent.INTEGRATION_EDIT,
            data={"integration": "webhooks", "project": project.slug},
        )

        assert ("edited") in entry2.get_note()
        assert entry2.actor == self.user
        assert entry2.target_object == self.project.id
        assert entry2.event == AuditLogEntryEvent.INTEGRATION_EDIT

        entry3 = create_audit_entry(
            request=self.req,
            organization=self.project.organization,
            target_object=self.project.id,
            event=AuditLogEntryEvent.INTEGRATION_REMOVE,
            data={"integration": "webhooks", "project": project.slug},
        )

        assert ("disable") in entry3.get_note()
        assert entry3.actor == self.user
        assert entry3.target_object == self.project.id
        assert entry3.event == AuditLogEntryEvent.INTEGRATION_REMOVE
