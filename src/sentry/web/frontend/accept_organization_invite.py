from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext as _

from sentry.models import OrganizationMember, Project
from sentry.web.frontend.base import BaseView


class AcceptInviteForm(forms.Form):
    pass


class AcceptOrganizationInviteView(BaseView):
    auth_required = False

    def get_form(self, request):
        if request.method == 'POST':
            return AcceptInviteForm(request.POST)
        return AcceptInviteForm()

    def handle(self, request, member_id, token):
        assert request.method in ['POST', 'GET']

        try:
            om = OrganizationMember.objects.get(pk=member_id)
        except OrganizationMember.DoesNotExist:
            messages.add_message(
                request, messages.ERROR,
                _('The invite link you followed is no longer valid.')
            )

            return self.redirect(reverse('sentry'))

        if not om.is_pending:
            messages.add_message(
                request, messages.ERROR,
                _('The invite link you followed is no longer valid.')
            )

            return self.redirect(reverse('sentry'))

        if om.token != token:
            messages.add_message(
                request, messages.ERROR,
                _('The invite link you followed is no longer valid.')
            )
            return self.redirect(reverse('sentry'))

        organization = om.organization

        if om.has_global_access:
            qs = Project.objects.filter(
                team__organization=organization,
            )
        else:
            qs = Project.objects.filter(
                team__in=om.teams.all(),
            )

        qs = qs.select_related('team')

        project_list = list(qs)

        context = {
            'organization': om.organization,
            'project_list': project_list,
            'needs_authentication': not request.user.is_authenticated(),
        }

        if not request.user.is_authenticated():
            # Show login or register form
            request.session['_next'] = request.get_full_path()
            request.session['can_register'] = True

            return self.respond('sentry/accept-organization-invite.html', context)

        form = self.get_form(request)
        if form.is_valid():
            om.user = request.user
            om.email = None
            om.save()

            request.session.pop('can_register', None)

            messages.add_message(
                request, messages.SUCCESS,
                _('You have been added to the %r organization.') % (
                    organization.name.encode('utf-8'),
                )
            )

            return self.redirect(reverse('sentry-organization-home', args=[organization.id]))

        context['form'] = form

        return self.respond('sentry/accept-organization-invite.html', context)
