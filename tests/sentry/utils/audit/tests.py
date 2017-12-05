from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser

from sentry.models import (
    ApiKey, AuditLogEntryEvent,
    DeletedOrganization, DeletedProject, DeletedTeam,
    Organization, User, Project, Team,
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

    def test_audit_entry_delete_organization(self):
        user = self.create_user()
        organization = self.create_organization(slug='slug123456789', owner=user)
        user.save()
        organization.save()

        assert User.objects.get(id=user.id) is not None
        assert Organization.objects.get(id=organization.id) is not None
        assert not DeletedOrganization.objects.filter(slug=organization.slug).exists()

        req = FakeHttpRequest(user)
        req.method = 'POST'
        req.path = '/organizations/%s/remove/' % (organization.slug)

        create_audit_entry(
            request=req,
            organization_id=organization.id,
            target_object=organization.id,
            event=AuditLogEntryEvent.ORG_REMOVE
        )

        deleted_org = DeletedOrganization.objects.get(slug=organization.slug)

        assert deleted_org is not None
        assert deleted_org.ip_address == req.META['REMOTE_ADDR']
        assert deleted_org.date_created == organization.date_added
        assert organization.name == deleted_org.name

    def test_deleted_organization(self):
        user = self.create_user()
        organization = self.create_organization(slug='slug123456789', owner=user)
        user.save()
        organization.save()

        assert User.objects.filter(id=user.id).exists()
        assert Organization.objects.filter(id=organization.id).exists()

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

        user.save()
        organization.save()
        team.save()
        project.save()

        assert User.objects.filter(id=user.id).exists()
        assert Project.objects.filter(id=project.id).exists()

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

        user.save()
        organization.save()
        team.save()

        assert User.objects.filter(id=user.id).exists()
        assert Team.objects.filter(id=team.id).exists()

        path = '/api/0/teams/%s/%s/' % (organization.slug, team.slug)

        self.login_as(user)
        self.client.delete(path)

        deleted_team = DeletedTeam.objects.get(slug=team.slug)

        assert Team.objects.get(id=team.id).status == TeamStatus.PENDING_DELETION
        DeletedEntryTest.check_deleted_log(deleted_team, team)

    def test_deleted_member(self):
        user = self.create_user()
        organization = self.create_organization(slug='slug123456789', owner=user)
        team = self.create_team(organization=organization)
        project = self.create_project(team=team)

        user.save()
        organization.save()
        team.save()
        project.save()

        assert User.objects.filter(id=user.id).exists()
        assert Project.objects.filter(id=project.id).exists()

        path = '/api/0/projects/%s/%s/' % (organization.slug, project.slug)

        self.login_as(user)
        self.client.delete(path)

        deleted_project = DeletedProject.objects.get(slug=project.slug)

        assert Project.objects.get(id=project.id).status == ProjectStatus.PENDING_DELETION
        DeletedEntryTest.check_deleted_log(deleted_project, project)

    @staticmethod
    def check_deleted_log(deleted_log, original_object):
        assert deleted_log is not None
        assert deleted_log.date_created == original_object.date_added
        assert deleted_log.date_deleted > deleted_log.date_created
        assert original_object.name == deleted_log.name
