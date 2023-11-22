from django.contrib.auth.models import AnonymousUser
from django.http.request import HttpRequest

from sentry import audit_log
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.deletedorganization import DeletedOrganization
from sentry.models.deletedproject import DeletedProject
from sentry.models.deletedteam import DeletedTeam
from sentry.models.organization import Organization, OrganizationStatus
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode
from sentry.utils.audit import (
    create_audit_entry,
    create_audit_entry_from_user,
    create_system_audit_entry,
)

username = "hello" * 20


def fake_http_request(user):
    request = HttpRequest()
    request.user = user
    request.META["REMOTE_ADDR"] = "127.0.0.1"
    return request


@all_silo_test
class CreateAuditEntryTest(TestCase):
    def setUp(self):
        self.user = self.create_user(username=username)
        self.req = fake_http_request(self.user)
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(teams=[self.team], platform="java")

    def assert_no_delete_log_created(self):
        with assume_test_silo_mode(SiloMode.REGION):
            assert not DeletedOrganization.objects.filter(slug=self.org.slug).exists()
            assert not DeletedTeam.objects.filter(slug=self.team.slug).exists()
            assert not DeletedProject.objects.filter(slug=self.project.slug).exists()

    def test_audit_entry_api(self):
        org = self.create_organization()
        apikey = self.create_api_key(org, allowed_origins="*")

        req = fake_http_request(AnonymousUser())
        req.auth = apikey

        entry = create_audit_entry(req)
        assert entry.actor_key == apikey
        assert entry.actor is None
        assert entry.ip_address == req.META["REMOTE_ADDR"]

        self.assert_no_delete_log_created()

    def test_audit_entry_frontend(self):
        req = fake_http_request(self.create_user())
        entry = create_audit_entry(req)

        assert entry.actor == req.user
        assert entry.actor_key is None
        assert entry.ip_address == req.META["REMOTE_ADDR"]

        self.assert_no_delete_log_created()

    def test_audit_entry_org_delete_log(self):
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            return

        entry = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.org.id,
            event=audit_log.get_event_id("ORG_REMOVE"),
            data=self.org.get_audit_log_data(),
        )

        assert entry.actor == self.user
        assert (
            entry.actor_label is None
        )  # you won't get this back since it only expands on the control silo
        assert entry.target_object == self.org.id
        assert entry.event == audit_log.get_event_id("ORG_REMOVE")

        deleted_org = DeletedOrganization.objects.get(slug=self.org.slug)
        self.assert_valid_deleted_log(deleted_org, self.org)

    def test_audit_entry_org_restore_log(self):
        with assume_test_silo_mode(SiloMode.REGION):
            Organization.objects.get(id=self.organization.id).update(
                status=OrganizationStatus.PENDING_DELETION
            )

            org = Organization.objects.get(id=self.organization.id)

            Organization.objects.get(id=self.organization.id).update(
                status=OrganizationStatus.DELETION_IN_PROGRESS
            )

            org2 = Organization.objects.get(id=self.organization.id)

            Organization.objects.get(id=self.organization.id).update(
                status=OrganizationStatus.ACTIVE
            )

            org3 = Organization.objects.get(id=self.organization.id)

        orgs = [org, org2, org3]

        entry = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.org.id,
            event=audit_log.get_event_id("ORG_RESTORE"),
            data=self.org.get_audit_log_data(),
        )
        audit_log_event = audit_log.get(entry.event)

        entry2 = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.org.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            data=self.org.get_audit_log_data(),
        )
        audit_log_event2 = audit_log.get(entry2.event)

        for i in orgs:
            if (
                i.status == OrganizationStatus.PENDING_DELETION
                or i.status == OrganizationStatus.DELETION_IN_PROGRESS
            ):
                assert i.status != OrganizationStatus.ACTIVE
                assert ("restored") in audit_log_event.render(entry)
                assert entry.actor == self.user
                assert entry.target_object == self.org.id
                assert entry.event == audit_log.get_event_id("ORG_RESTORE")
            else:
                assert i.status == OrganizationStatus.ACTIVE
                assert ("edited") in audit_log_event2.render(entry2)
                assert entry2.actor == self.user
                assert entry2.target_object == self.org.id
                assert entry2.event == audit_log.get_event_id("ORG_EDIT")

    def test_audit_entry_team_delete_log(self):
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            return

        entry = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.team.id,
            event=audit_log.get_event_id("TEAM_REMOVE"),
            data=self.team.get_audit_log_data(),
        )

        assert entry.actor == self.user
        assert entry.target_object == self.team.id
        assert entry.event == audit_log.get_event_id("TEAM_REMOVE")

        deleted_team = DeletedTeam.objects.get(slug=self.team.slug)
        self.assert_valid_deleted_log(deleted_team, self.team)

    def test_audit_entry_api_key(self):
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            return

        key = self.create_api_key(self.organization)

        with outbox_runner():
            create_audit_entry_from_user(
                None,
                api_key=key,
                organization=self.organization,
                target_object=self.project.id,
                event=audit_log.get_event_id("PROJECT_ADD"),
            )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert (
                AuditLogEntry.objects.get(event=audit_log.get_event_id("PROJECT_ADD")).actor_label
                == key.key
            )

    def test_audit_entry_project_delete_log(self):
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            return

        entry = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.project.id,
            event=audit_log.get_event_id("PROJECT_REMOVE"),
            data=self.project.get_audit_log_data(),
        )
        audit_log_event = audit_log.get(entry.event)

        assert entry.actor == self.user
        assert entry.target_object == self.project.id
        assert entry.event == audit_log.get_event_id("PROJECT_REMOVE")
        assert audit_log_event.render(entry) == "removed project" + " " + self.project.slug

        deleted_project = DeletedProject.objects.get(slug=self.project.slug)
        self.assert_valid_deleted_log(deleted_project, self.project)
        assert deleted_project.platform == self.project.platform

    def test_audit_entry_project_delete_with_origin_log(self):
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            return

        entry = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.project.id,
            event=audit_log.get_event_id("PROJECT_REMOVE_WITH_ORIGIN"),
            data={**self.project.get_audit_log_data(), "origin": "settings"},
        )
        audit_log_event = audit_log.get(entry.event)

        assert entry.actor == self.user
        assert entry.target_object == self.project.id
        assert entry.event == audit_log.get_event_id("PROJECT_REMOVE_WITH_ORIGIN")
        assert (
            audit_log_event.render(entry)
            == "removed project" + " " + self.project.slug + " in settings"
        )

        deleted_project = DeletedProject.objects.get(slug=self.project.slug)
        self.assert_valid_deleted_log(deleted_project, self.project)
        assert deleted_project.platform == self.project.platform

    def test_audit_entry_project_edit_log(self):
        entry = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.project.id,
            event=audit_log.get_event_id("PROJECT_EDIT"),
            data={"old_slug": "old", "new_slug": "new"},
        )
        audit_log_event = audit_log.get(entry.event)

        assert entry.actor == self.user
        assert entry.target_object == self.project.id
        assert entry.event == audit_log.get_event_id("PROJECT_EDIT")
        assert audit_log_event.render(entry) == "renamed project slug from old to new"

    def test_audit_entry_project_edit_log_regression(self):
        entry = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.project.id,
            event=audit_log.get_event_id("PROJECT_EDIT"),
            data={"new_slug": "new"},
        )
        audit_log_event = audit_log.get(entry.event)

        assert entry.actor == self.user
        assert entry.target_object == self.project.id
        assert entry.event == audit_log.get_event_id("PROJECT_EDIT")
        assert audit_log_event.render(entry) == "edited project settings in new_slug to new"

    def test_audit_entry_project_performance_setting_disable_detection(self):
        entry = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.project.id,
            event=audit_log.get_event_id("PROJECT_PERFORMANCE_ISSUE_DETECTION_CHANGE"),
            data={"file_io_on_main_thread_detection_enabled": False},
        )
        audit_log_event = audit_log.get(entry.event)

        assert entry.actor == self.user
        assert entry.target_object == self.project.id
        assert entry.event == audit_log.get_event_id("PROJECT_PERFORMANCE_ISSUE_DETECTION_CHANGE")
        assert (
            audit_log_event.render(entry)
            == "edited project performance issue detector settings to disable detection of File IO on Main Thread issue"
        )

    def test_audit_entry_project_performance_setting_enable_detection(self):
        entry = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.project.id,
            event=audit_log.get_event_id("PROJECT_PERFORMANCE_ISSUE_DETECTION_CHANGE"),
            data={"file_io_on_main_thread_detection_enabled": True},
        )
        audit_log_event = audit_log.get(entry.event)

        assert entry.actor == self.user
        assert entry.target_object == self.project.id
        assert entry.event == audit_log.get_event_id("PROJECT_PERFORMANCE_ISSUE_DETECTION_CHANGE")
        assert (
            audit_log_event.render(entry)
            == "edited project performance issue detector settings to enable detection of File IO on Main Thread issue"
        )

    def test_audit_entry_project_ownership_rule_edit(self):
        entry = create_audit_entry(
            request=self.req,
            organization=self.org,
            target_object=self.project.id,
            event=audit_log.get_event_id("PROJECT_OWNERSHIPRULE_EDIT"),
        )
        audit_log_event = audit_log.get(entry.event)

        assert entry.actor == self.user
        assert entry.target_object == self.project.id
        assert entry.event == audit_log.get_event_id("PROJECT_OWNERSHIPRULE_EDIT")
        assert audit_log_event.render(entry) == "modified ownership rules"

    def test_audit_entry_integration_log(self):
        project = self.create_project()
        self.login_as(user=self.user)

        entry = create_audit_entry(
            request=self.req,
            organization=self.project.organization,
            target_object=self.project.id,
            event=audit_log.get_event_id("INTEGRATION_ADD"),
            data={"integration": "webhooks", "project": project.slug},
        )
        audit_log_event = audit_log.get(entry.event)

        assert ("enabled") in audit_log_event.render(entry)
        assert entry.actor == self.user
        assert entry.target_object == self.project.id
        assert entry.event == audit_log.get_event_id("INTEGRATION_ADD")

        entry2 = create_audit_entry(
            request=self.req,
            organization=self.project.organization,
            target_object=self.project.id,
            event=audit_log.get_event_id("INTEGRATION_EDIT"),
            data={"integration": "webhooks", "project": project.slug},
        )
        audit_log_event2 = audit_log.get(entry2.event)

        assert ("edited") in audit_log_event2.render(entry2)
        assert entry2.actor == self.user
        assert entry2.target_object == self.project.id
        assert entry2.event == audit_log.get_event_id("INTEGRATION_EDIT")

        entry3 = create_audit_entry(
            request=self.req,
            organization=self.project.organization,
            target_object=self.project.id,
            event=audit_log.get_event_id("INTEGRATION_REMOVE"),
            data={"integration": "webhooks", "project": project.slug},
        )
        audit_log_event3 = audit_log.get(entry3.event)

        assert ("disable") in audit_log_event3.render(entry3)
        assert entry3.actor == self.user
        assert entry3.target_object == self.project.id
        assert entry3.event == audit_log.get_event_id("INTEGRATION_REMOVE")

    def test_create_system_audit_entry(self):
        entry = create_system_audit_entry(
            organization=self.org,
            target_object=self.org.id,
            event=audit_log.get_event_id("SSO_DISABLE"),
            data={"provider": "GitHub"},
        )

        assert entry.event == audit_log.get_event_id("SSO_DISABLE")
        assert entry.actor_label == "Sentry"
        assert entry.organization_id == self.org.id
        assert entry.target_object == self.org.id
        assert audit_log.get(entry.event).render(entry) == "disabled sso (GitHub)"
