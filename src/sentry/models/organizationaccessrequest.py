from django.conf import settings
from django.db.models import Q
from django.urls import reverse

from sentry import roles
from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.users.services.user.service import user_service


@region_silo_model
class OrganizationAccessRequest(Model):
    __relocation_scope__ = RelocationScope.Organization

    team = FlexibleForeignKey("sentry.Team")
    member = FlexibleForeignKey("sentry.OrganizationMember")
    # access request from a different user than the member
    requester_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE", null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationaccessrequest"
        unique_together = (("team", "member"),)

    __repr__ = sane_repr("team_id", "member_id")

    def send_request_email(self):
        from sentry.models.organizationmember import OrganizationMember
        from sentry.utils.email import MessageBuilder

        organization = self.team.organization
        if not self.member.user_id:
            return
        user = user_service.get_user(user_id=self.member.user_id)
        if user is None:
            return
        email = user.email

        context = {
            "email": email,
            "name": user.get_display_name(),
            "organization": organization,
            "team": self.team,
            "url": organization.absolute_url(
                reverse(
                    "sentry-organization-teams",
                    kwargs={"organization_slug": organization.slug},
                )
            ),
        }

        if self.requester_id:
            requester = user_service.get_user(user_id=self.requester_id)
            if requester is not None:
                context.update({"requester": requester.get_display_name()})

        msg = MessageBuilder(
            subject="Sentry Access Request",
            template="sentry/emails/request-team-access.txt",
            html_template="sentry/emails/request-team-access.html",
            type="team.access.request",
            context=context,
        )

        global_roles = [r.id for r in roles.with_scope("org:write") if r.is_global]
        team_roles = [r.id for r in roles.with_scope("team:write")]

        # find members which are either team scoped or have access to all teams
        member_list = OrganizationMember.objects.filter(
            Q(role__in=global_roles) | Q(teams=self.team, role__in=team_roles),
            organization=self.team.organization,
            user_id__isnull=False,
        ).values_list("user_id", flat=True)
        member_users = user_service.get_many_by_id(
            ids=[uid for uid in member_list if uid is not None]
        )

        msg.send_async([user.email for user in member_users])

    def send_approved_email(self):
        from sentry.utils.email import MessageBuilder

        if self.member.user_id is None:
            return

        user = user_service.get_user(user_id=self.member.user_id)
        if user is None:
            return

        email = user.email
        organization = self.team.organization

        context = {
            "email": email,
            "name": user.get_display_name(),
            "organization": organization,
            "team": self.team,
        }

        msg = MessageBuilder(
            subject="Sentry Access Request",
            template="sentry/emails/access-approved.txt",
            html_template="sentry/emails/access-approved.html",
            type="team.access.approved",
            context=context,
        )

        msg.send_async([email])
