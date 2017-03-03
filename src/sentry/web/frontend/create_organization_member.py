from __future__ import absolute_import

from django.conf import settings
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry import roles
from sentry.models import Team, TeamStatus
from sentry.signals import member_invited
from sentry.web.frontend.base import OrganizationView
from sentry.web.forms.invite_organization_member import InviteOrganizationMemberForm
from sentry.web.forms.add_organization_member import AddOrganizationMemberForm


class CreateOrganizationMemberView(OrganizationView):
    required_scope = 'org:write'

    def get_form(self, request, organization, all_teams, allowed_roles):

        # If there is only one possible team to join, select it by default
        initial_teams = []
        if len(all_teams) == 1:
            initial_teams = all_teams

        initial = {
            'role': organization.default_role,
            'teams': initial_teams
        }

        if settings.SENTRY_ENABLE_INVITES:
            form_cls = InviteOrganizationMemberForm
        else:
            form_cls = AddOrganizationMemberForm

        return form_cls(
            data=request.POST or None,
            all_teams=all_teams,
            allowed_roles=allowed_roles,
            initial=initial,
        )

    def handle(self, request, organization):
        can_admin, allowed_roles = self.get_allowed_roles(request, organization)

        all_teams = Team.objects.filter(
            organization=organization,
            status=TeamStatus.VISIBLE
        )

        form = self.get_form(request, organization, all_teams, allowed_roles)
        if form.is_valid():
            om, created = form.save(request.user, organization, request.META['REMOTE_ADDR'])

            user_display = form.cleaned_data.get('email', None)
            if not user_display:
                user_display = form.cleaned_data['user']

            if created:
                messages.add_message(request, messages.SUCCESS,
                    _('The organization member %s was added.') % user_display)

                member_invited.send(member=om, user=request.user, sender=self)

            else:
                messages.add_message(request, messages.INFO,
                    _('The organization member %s already exists.') % user_display)

            redirect = reverse('sentry-organization-members', args=[organization.slug])

            return HttpResponseRedirect(redirect)

        context = {
            'form': form,
            'is_invite': settings.SENTRY_ENABLE_INVITES,
            'role_list': [
                (r, r in allowed_roles)
                for r in roles.get_all()
            ],
            'all_teams': all_teams
        }

        return self.respond('sentry/create-organization-member.html', context)
