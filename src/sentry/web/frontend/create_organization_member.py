from __future__ import absolute_import

from django.conf import settings
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry import roles
from sentry.signals import member_invited
from sentry.web.frontend.base import OrganizationView
from sentry.web.forms.invite_organization_member import InviteOrganizationMemberForm
from sentry.web.forms.add_organization_member import AddOrganizationMemberForm


class CreateOrganizationMemberView(OrganizationView):
    required_scope = 'org:write'

    def get_form(self, request, organization):
        initial = {
            'role': organization.default_role,
        }

        if settings.SENTRY_ENABLE_INVITES:
            form_cls = InviteOrganizationMemberForm
        else:
            form_cls = AddOrganizationMemberForm

        return form_cls(request.POST or None, initial=initial)

    def handle(self, request, organization):
        form = self.get_form(request, organization)
        if form.is_valid():
            om, created = form.save(request.user, organization, request.META['REMOTE_ADDR'])

            if created:
                messages.add_message(request, messages.SUCCESS,
                    _('The organization member was added.'))

                member_invited.send(member=om, user=request.user, sender=self)

            else:
                messages.add_message(request, messages.INFO,
                    _('The organization member already exists.'))

            redirect = reverse('sentry-organization-member-settings',
                               args=[organization.slug, om.id])

            return HttpResponseRedirect(redirect)

        context = {
            'form': form,
            'is_invite': settings.SENTRY_ENABLE_INVITES,
            'role_list': roles.get_all(),
        }

        return self.respond('sentry/create-organization-member.html', context)
