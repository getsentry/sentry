from __future__ import absolute_import

from django.contrib import messages
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext_lazy as _, ugettext

from sentry.models import OrganizationMember, OrganizationMemberType, Team
from sentry.web.frontend.base import OrganizationView
from sentry.web.forms.edit_organization_member import EditOrganizationMemberForm


class OrganizationMemberSettingsView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get_form(self, request, member, authorizing_access):
        return EditOrganizationMemberForm(
            authorizing_access=authorizing_access,
            data=request.POST or None,
            instance=member,
            initial={
                'type': member.type,
                'has_global_access': member.has_global_access,
                'teams': member.teams.all(),
            }
        )

    def resend_invite(self, request, organization, member):
        messages.success(request, ugettext('An invitation to join %(organization)s has been sent to %(email)s') % {
            'organization': organization.name,
            'email': member.email,
        })

        member.send_invite_email()

        redirect = reverse('sentry-organization-member-settings',
                           args=[organization.slug, member.id])

        return self.redirect(redirect)

    def view_member(self, request, organization, member):
        context = {
            'member': member,
            'enabled_teams': set(member.teams.all()),
            'all_teams': Team.objects.filter(
                organization=organization,
            ),
        }

        return self.respond('sentry/organization-member-details.html', context)

    def handle(self, request, organization, member_id):
        try:
            member = OrganizationMember.objects.get(id=member_id)
        except OrganizationMember.DoesNotExist:
            print("cannot find member id")
            return self.redirect(reverse('sentry'))

        if request.POST.get('op') == 'reinvite' and member.is_pending:
            return self.resend_invite(request, organization, member)

        if request.user.is_superuser:
            authorizing_access = OrganizationMemberType.OWNER
        else:
            membership = OrganizationMember.objects.get(
                user=request.user,
                organization=organization,
            )
            authorizing_access = membership.type

        if member.user == request.user or authorizing_access > member.type:
            return self.view_member(request, organization, member)

        form = self.get_form(request, member, authorizing_access)
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
        }

        return self.respond('sentry/organization-member-settings.html', context)
