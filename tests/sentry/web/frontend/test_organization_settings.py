from __future__ import absolute_import

# from django.core import mail
from django.core.urlresolvers import reverse

# from sentry.models import AuditLogEntry, AuditLogEntryEvent, OrganizationMember
from sentry.testutils import TestCase, PermissionTestCase


class Organization2FAPermissionTest(PermissionTestCase):
    def setUp(self):
        super(Organization2FAPermissionTest, self).setUp()
        member = self.create_user()
        om = self.create_member(user=member, organization=self.organization)
        self.path = reverse(
            'sentry-organization-member-settings', args=[self.organization.slug, om.id]
        )

    def test_non_compliant_member_cannot_load(self):
        self.assert_non_member_cannot_access(self.path)

    def test_compliant_member_can_load(self):
        self.assert_member_can_access(self.path)

    # not allow compliant new members who remove all auth
    def test_compliant_member_remove_2FA_cannot_load(self):
        pass


class OrganizationSettingsTest(TestCase):
    def test_renders_with_context(self):
        pass


class OrganizationSettings2FATest(TestCase):

    def test_doesnt_render_2FA_setting_for_non_admin(self):
        pass

    def test_admin_can_set_2FA(self):
        pass

    def test_nonadmin_cannot_set_2FA(self):
        pass

    def test_enable_2FA_only_if_2FA_enabled_personal_account(self):
        pass

    def test_new_member_must_enable_2FA(self):
        # prior to joing!
        pass

    def test_non_compliant_members_notified(self):
        # recieve an email that 2FA must be enabled
        pass

    def test_new_sentry_user_join_must_enable_2FA(self):
        pass

    def test_non_complaint_members_are_blocked(self):
        pass

    def test_member_disable_all_2FA_blocked(self):
        pass
