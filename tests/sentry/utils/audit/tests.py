from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser

from sentry.models import (
    ApiKey,
    DeletedOrganization, DeletedProject, DeletedTeam,
    Organization, Project, Team,
    OrganizationStatus, ProjectStatus, TeamStatus,

)
from sentry.testutils import APITestCase
from sentry.utils.audit import create_audit_entry


class FakeHttpRequest(object):
    def __init__(self, user):
        self.user = user
        self.META = {'REMOTE_ADDR': '127.0.0.1'}


class CreateAuditEntryTest(APITestCase):

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

    def test_audit_entry_frontend(self):
        req = FakeHttpRequest(self.create_user())
        entry = create_audit_entry(req)

        assert entry.actor == req.user
        assert entry.actor_key is None
        assert entry.ip_address == req.META['REMOTE_ADDR']


class DeletedEntryTest(APITestCase):

    def test_deleted_organization(self):
        user = self.create_user()
        organization = self.create_organization(slug='slug123456789', owner=user)

        path = '/organizations/%s/remove/' % (organization.slug)

        self.login_as(user)
        self.client.post(path)

        deleted_org = DeletedOrganization.objects.get(slug=organization.slug)

        assert Organization.objects.get(
            id=organization.id).status == OrganizationStatus.PENDING_DELETION
        DeletedEntryTest.check_deleted_log(deleted_org, organization)

    def test_deleted_project(self):
        user = self.create_user()
        organization = self.create_organization(slug='slug123456789', owner=user)
        team = self.create_team(organization=organization)
        project = self.create_project(team=team)

        path = '/api/0/projects/%s/%s/' % (organization.slug, project.slug)

        self.login_as(user)
        self.client.delete(path)

        deleted_project = DeletedProject.objects.get(slug=project.slug)

        assert Project.objects.get(id=project.id).status == ProjectStatus.PENDING_DELETION
        DeletedEntryTest.check_deleted_log(deleted_project, project)

    def test_deleted_team(self):
        user = self.create_user()
        organization = self.create_organization(slug='slug123456789', owner=user)
        team = self.create_team(organization=organization)

        path = '/api/0/teams/%s/%s/' % (organization.slug, team.slug)

        self.login_as(user)
        self.client.delete(path)

        deleted_team = DeletedTeam.objects.get(slug=team.slug)

        assert Team.objects.get(id=team.id).status == TeamStatus.PENDING_DELETION
        DeletedEntryTest.check_deleted_log(deleted_team, team)

    @staticmethod
    def check_deleted_log(deleted_log, original_object):
        assert deleted_log is not None
        assert original_object.name == deleted_log.name

        # Truncating datetime for mysql compatibility
        assert deleted_log.date_created.replace(
            microsecond=0) == original_object.date_added.replace(microsecond=0)
        assert deleted_log.date_deleted >= deleted_log.date_created
