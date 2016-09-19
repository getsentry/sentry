from __future__ import absolute_import

from django.contrib import messages
from django.core.urlresolvers import reverse
from django.db.models import Q
from django.utils.translation import ugettext_lazy as _, ugettext

from sentry import roles
from sentry.models import OrganizationMember, OrganizationMemberTeam, \
    Team, TeamStatus
from sentry.utils import auth
from sentry.web.frontend.base import OrganizationView
from sentry.web.forms.edit_organization_member import EditOrganizationMemberForm


class OrganizationMemberSettingsView(OrganizationView):
    def get_form(self, request, member, all_teams, allowed_roles):
        return EditOrganizationMemberForm(
            data=request.POST or None,
            instance=member,
            all_teams=all_teams,
            allowed_roles=allowed_roles,
            initial={
                'role': member.role,
                'teams': Team.objects.filter(
                    id__in=OrganizationMemberTeam.objects.filter(
                        organizationmember=member,
                    ).values('team'),
                ),
            },
        )

    def resend_invite(self, request, organization, member, regen=False):
        if regen:
            member.update(token=member.generate_token())
            messages.success(request, ugettext('A new invitation has been generated and sent to %(email)s') % {
                'organization': organization.name,
                'email': member.email,
            })
        else:
            messages.success(request, ugettext('An invitation to join %(organization)s has been sent to %(email)s') % {
                'organization': organization.name,
                'email': member.email,
            })

        member.send_invite_email()

        redirect = reverse('sentry-organization-member-settings',
                           args=[organization.slug, member.id])

        return self.redirect(redirect)

    def view_member(self, request, organization, member, all_teams):
        context = {
            'member': member,
            'enabled_teams': set(member.teams.all()),
            'all_teams': all_teams,
            'role_list': roles.get_all(),
        }

        return self.respond('sentry/organization-member-details.html', context)

    def handle(self, request, organization, member_id):
        try:
            member = OrganizationMember.objects.get(
                Q(user__is_active=True) | Q(user__isnull=True),
                organization=organization,
                id=member_id,
            )
        except OrganizationMember.DoesNotExist:
            return self.redirect(auth.get_login_url())

        if request.POST.get('op') == 'reinvite' and member.is_pending:
            return self.resend_invite(request, organization, member)
        elif request.POST.get('op') == 'regenerate' and member.is_pending:
            return self.resend_invite(request, organization, member, regen=True)

        can_admin, allowed_roles = self.get_allowed_roles(request, organization, member)

        all_teams = Team.objects.filter(
            organization=organization,
            status=TeamStatus.VISIBLE
        )

        if member.user == request.user or not can_admin:
            return self.view_member(request, organization, member, all_teams)

        form = self.get_form(request, member, all_teams, allowed_roles)
        if form.is_valid():
            member = form.save(request.user, organization, request.META['REMOTE_ADDR'])

            messages.add_message(request, messages.SUCCESS,
                _('Your changes were saved.'))

            redirect = reverse('sentry-organization-member-settings',
                               args=[organization.slug, member.id])

            return self.redirect(redirect)

        context = {
            'member': member,
            'form': form,
            'invite_link': member.get_invite_link(),
            'role_list': [
                (r, r in allowed_roles)
                for r in roles.get_all()
            ],
            'all_teams': all_teams
        }

        return self.respond('sentry/organization-member-settings.html', context)
