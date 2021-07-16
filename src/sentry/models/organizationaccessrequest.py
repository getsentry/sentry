from typing import TYPE_CHECKING, AbstractSet, Sequence

from django.conf import settings
from django.db.models import Q
from django.urls import reverse

from sentry import roles
from sentry.db.models import BaseManager, FlexibleForeignKey, Model, sane_repr
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.models import Team, User


class OrganizationAccessRequestManager(BaseManager):
    def get_access_requests(self, team_list: Sequence["Team"], user: "User") -> AbstractSet["Team"]:
        return frozenset(
            self.filter(team__in=team_list, member__user=user).values_list("team", flat=True)
        )


class OrganizationAccessRequest(Model):
    __include_in_export__ = True

    team = FlexibleForeignKey("sentry.Team")
    member = FlexibleForeignKey("sentry.OrganizationMember")
    # access request from a different user than the member
    requester = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=True)

    objects = OrganizationAccessRequestManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationaccessrequest"
        unique_together = (("team", "member"),)

    __repr__ = sane_repr("team_id", "member_id")

    def send_request_email(self):
        from sentry.models import OrganizationMember
        from sentry.utils.email import MessageBuilder

        user = self.member.user
        email = user.email
        organization = self.team.organization

        context = {
            "email": email,
            "name": user.get_display_name(),
            "organization": organization,
            "team": self.team,
            "url": absolute_uri(
                reverse(
                    "sentry-organization-members-requests",
                    kwargs={"organization_slug": organization.slug},
                )
            ),
        }

        if self.requester:
            context.update({"requester": self.requester.get_display_name()})

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
            user__isnull=False,
        ).select_related("user")

        msg.send_async([m.user.email for m in member_list])

    def send_approved_email(self):
        from sentry.utils.email import MessageBuilder

        user = self.member.user
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
