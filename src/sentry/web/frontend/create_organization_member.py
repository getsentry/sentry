from __future__ import absolute_import

from django.conf import settings
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import OrganizationMemberType
from sentry.permissions import can_add_organization_member
from sentry.web.frontend.base import OrganizationView
from sentry.web.forms.invite_organization_member import InviteOrganizationMemberForm
from sentry.web.forms.add_organization_member import AddOrganizationMemberForm


class CreateOrganizationMemberView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get_form(self, request):
        initial = {
            'type': OrganizationMemberType.MEMBER,
        }

        if settings.SENTRY_ENABLE_INVITES:
            form_cls = InviteOrganizationMemberForm
        else:
            form_cls = AddOrganizationMemberForm

        return form_cls(request.POST or None, initial=initial)

    def handle(self, request, organization):
        if not can_add_organization_member(request.user, organization):
            return HttpResponseRedirect(reverse('sentry'))

        form = self.get_form(request)
        if form.is_valid():
            om, created = form.save(request.user, organization, request.META['REMOTE_ADDR'])

            if created:
                messages.add_message(request, messages.SUCCESS,
                    _('The organization member was added.'))
            else:
                messages.add_message(request, messages.INFO,
                    _('The organization member already exists.'))

            redirect = reverse('sentry-organization-member-settings',
                               args=[organization.slug, om.id])

            return HttpResponseRedirect(redirect)

        context = {
            'form': form,
            'is_invite': settings.SENTRY_ENABLE_INVITES,
        }

        return self.respond('sentry/create-organization-member.html', context)
