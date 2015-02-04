from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext_lazy as _

from sentry.models import OrganizationMemberType, OrganizationStatus
from sentry.tasks.deletion import delete_organization
from sentry.web.frontend.base import OrganizationView


MSG_REMOVE_SUCCESS = _('The %s organization has been scheduled for removal.')


class RemoveOrganizationForm(forms.Form):
    pass


class RemoveOrganizationView(OrganizationView):
    required_access = OrganizationMemberType.OWNER
    sudo_required = True

    def get_form(self, request, organization):
        if request.method == 'POST':
            return RemoveOrganizationForm(request.POST)
        return RemoveOrganizationForm()

    def handle(self, request, organization):
        form = self.get_form(request, organization)
        if form.is_valid():
            if organization.status != OrganizationStatus.PENDING_DELETION:
                organization.update(status=OrganizationStatus.PENDING_DELETION)

                delete_organization.apply_async(kwargs={
                    'object_id': organization.id,
                }, countdown=60 * 5)

            messages.add_message(request, messages.SUCCESS,
                MSG_REMOVE_SUCCESS % (organization.name,))

            return self.redirect(reverse('sentry'))

        context = {
            'form': form,
            'team_list': organization.team_set.all(),
        }

        return self.respond('sentry/remove-organization.html', context)
