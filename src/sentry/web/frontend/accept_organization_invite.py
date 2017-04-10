from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.utils.crypto import constant_time_compare
from django.utils.translation import ugettext_lazy as _

from sentry.models import (
    AuditLogEntryEvent, OrganizationMember, Project
)
from sentry.signals import member_joined
from sentry.utils import auth
from sentry.web.frontend.base import BaseView

ERR_INVITE_INVALID = _('The invite link you followed is not valid.')


class AcceptInviteForm(forms.Form):
    pass


class AcceptOrganizationInviteView(BaseView):
    auth_required = False

    def get_form(self, request):
        if request.method == 'POST':
            return AcceptInviteForm(request.POST)
        return AcceptInviteForm()

    def handle(self, request, member_id, token):
        assert request.method in ('POST', 'GET')

        try:
            om = OrganizationMember.objects.get(pk=member_id)
        except OrganizationMember.DoesNotExist:
            messages.add_message(
                request, messages.ERROR,
                ERR_INVITE_INVALID,
            )

            return self.redirect(reverse('sentry'))

        if not om.is_pending:
            messages.add_message(
                request, messages.ERROR,
                ERR_INVITE_INVALID,
            )

            return self.redirect(reverse('sentry'))

        if not constant_time_compare(om.token or om.legacy_token, token):
            messages.add_message(
                request, messages.ERROR,
                ERR_INVITE_INVALID,
            )
            return self.redirect(reverse('sentry'))

        organization = om.organization

        qs = Project.objects.filter(
            organization=organization,
        )
        project_list = list(qs.select_related('team')[:25])
        project_count = qs.count()

        context = {
            'organization': om.organization,
            'project_list': project_list,
            'project_count': project_count,
            'needs_authentication': not request.user.is_authenticated(),
            'logout_url': '{}?next={}'.format(
                reverse('sentry-logout'),
                request.path,
            ),
            'login_url': '{}?next={}'.format(
                reverse('sentry-login'),
                request.path,
            ),
            'register_url': '{}?next={}'.format(
                reverse('sentry-register'),
                request.path,
            ),
        }

        if not request.user.is_authenticated():
            # Show login or register form
            auth.initiate_login(request, next_url=request.get_full_path())
            request.session['can_register'] = True
            request.session['invite_email'] = om.email

            return self.respond('sentry/accept-organization-invite.html', context)

        # if they're already a member of the organization its likely they're
        # using a shared account and either previewing this invite or
        # are incorrectly expecting this to create a new account for them
        context['existing_member'] = OrganizationMember.objects.filter(
            user=request.user.id,
            organization=om.organization_id,
        ).exists()

        form = self.get_form(request)
        if form.is_valid():
            if OrganizationMember.objects.filter(organization=organization, user=request.user).exists():
                messages.add_message(
                    request, messages.SUCCESS,
                    _('You are already a member of the %r organization.') % (
                        organization.name.encode('utf-8'),
                    )
                )

                om.delete()
            else:
                om.user = request.user
                om.email = None
                om.save()

                self.create_audit_entry(
                    request,
                    organization=organization,
                    target_object=om.id,
                    target_user=request.user,
                    event=AuditLogEntryEvent.MEMBER_ACCEPT,
                    data=om.get_audit_log_data(),
                )

                messages.add_message(
                    request, messages.SUCCESS,
                    _('You have been added to the %r organization.') % (
                        organization.name.encode('utf-8'),
                    )
                )

                member_joined.send(member=om, sender=self)

            request.session.pop('can_register', None)

            return self.redirect(reverse('sentry-organization-home', args=[organization.slug]))

        context['form'] = form

        return self.respond('sentry/accept-organization-invite.html', context)
