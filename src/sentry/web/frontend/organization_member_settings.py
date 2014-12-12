from __future__ import absolute_import

from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _, ugettext

from sentry.models import OrganizationMember, OrganizationMemberType
from sentry.web.frontend.base import OrganizationView
from sentry.web.forms.edit_organization_member import EditOrganizationMemberForm


class OrganizationMemberSettingsView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get_form(self, request, member):
        if request.user.is_superuser:
            authorizing_access = OrganizationMemberType.OWNER
        else:
            membership = OrganizationMember.objects.get(user=request.user)
            authorizing_access = membership.type

        return EditOrganizationMemberForm(
            authorizing_access=authorizing_access,
            data=request.POST or None,
            instance=member,
            initial={
                'teams': member.teams.all(),
            }
        )

    def handle(self, request, organization, member_id):
        try:
            member = OrganizationMember.objects.get(id=member_id)
        except OrganizationMember.DoesNotExist:
            return HttpResponseRedirect(reverse('sentry'))

        if request.POST.get('op') == 'reinvite' and member.is_pending:
            messages.success(request, ugettext('An invitation to join %(organization)s has been sent to %(email)s') % {
                'organization': organization.name,
                'email': member.email,
            })

            member.send_invite_email()

            redirect = reverse('sentry-organization-member-settings',
                               args=[organization.slug, member.id])

            return HttpResponseRedirect(redirect)

        form = self.get_form(request, member)
        if form.is_valid():
            member = form.save(request.user, organization, request.META['REMOTE_ADDR'])

            messages.add_message(request, messages.SUCCESS,
                _('Your changes were saved.'))

            redirect = reverse('sentry-organization-member-settings',
                               args=[organization.slug, member.id])

            return HttpResponseRedirect(redirect)

        context = {
            'member': member,
            'form': form,
        }

        return self.respond('sentry/organization-member-settings.html', context)
