from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.testutils.cases import TestMigrations


class BackfillNotificationSettingTest(TestMigrations):
    migrate_from = "0468_pickle_to_json_sentry_rawevent"
    migrate_to = "0469_backfill_orgmembermapping"

    def setup_initial_state(self):
        self.owner = self.create_user()
        self.member = OrganizationMember.objects.create(
            organization=self.organization,
            user_id=self.owner.id,
            role="owner",
        )
        self.invite = OrganizationMember.objects.create(
            organization=self.organization,
            email="test@example.com",
            inviter_id=self.user.id,
            role="member",
        )

        member_user = self.create_user()
        self.member_with_mapping = OrganizationMember.objects.create(
            organization=self.organization,
            user_id=member_user.id,
            role="member",
        )
        OrganizationMemberMapping.objects.create(
            organization_id=self.organization.id,
            organizationmember_id=self.member_with_mapping.id,
            user_id=member_user.id,
            role=self.member_with_mapping.role,
        )

    def test(self):
        # Generated mapping for invite record.
        mapping = OrganizationMemberMapping.objects.get(email=self.invite.email)
        assert mapping.inviter_id == self.invite.inviter_id
        assert mapping.organizationmember_id == self.invite.id
        assert mapping.organization_id == self.invite.organization_id
        assert mapping.user_id is None
        assert mapping.role == self.invite.role

        # Generated mapping for member record
        mapping = OrganizationMemberMapping.objects.get(organizationmember_id=self.member.id)
        assert mapping.organizationmember_id == self.member.id
        assert mapping.organization_id == self.member.organization_id
        assert mapping.user_id == self.member.user_id
        assert mapping.role == self.member.role

        # No duplicates created
        assert (
            OrganizationMemberMapping.objects.filter(
                user_id=self.member_with_mapping.user_id
            ).count()
            == 1
        )
