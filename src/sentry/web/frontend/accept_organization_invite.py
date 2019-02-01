from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.utils.crypto import constant_time_compare
from django.utils.translation import ugettext_lazy as _

from sentry.models import AuditLogEntryEvent, Authenticator, OrganizationMember
from sentry.signals import member_joined
from sentry.utils import auth
from sentry.web.frontend.base import BaseView

ERR_INVITE_INVALID = _('The invite link you followed is not valid, or has expired.')
PENDING_INVITE = 'pending-invite'
COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


class AcceptInviteForm(forms.Form):
    pass


class AcceptOrganizationInviteView(BaseView):
    auth_required = False

    def get_form(self, request):
        if request.method == 'POST':
            return AcceptInviteForm(request.POST)
        return AcceptInviteForm()

    def redirect_with_err_message(self, request):
        messages.add_message(
            request,
            messages.ERROR,
            ERR_INVITE_INVALID,
        )

        return self.redirect(reverse('sentry'))

    def handle(self, request, member_id, token):
        assert request.method in ('POST', 'GET')

        try:
            helper = WebInviteHelper(
                instance=self,
                request=request,
                member_id=member_id,
                token=token
            )
        except OrganizationMember.DoesNotExist:
            return self.redirect_with_err_message(request)

        if not helper.member_pending or not helper.valid_token:
            return self.redirect_with_err_message(request)

        om = helper.om
        organization = om.organization

        context = {
            'org_name': organization.name,
            'needs_authentication': not helper.user_authenticated,
            'needs_2fa': helper.needs_2fa,
            'logout_url': u'{}?next={}'.format(
                reverse('sentry-logout'),
                request.path,
            ),
            'login_url': u'{}?next={}'.format(
                reverse('sentry-login'),
                request.path,
            ),
            'register_url': u'{}?next={}'.format(
                reverse('sentry-register'),
                request.path,
            ),
        }

        if not helper.user_authenticated:
            # Show login or register form
            auth.initiate_login(request, next_url=request.get_full_path())
            request.session['can_register'] = True
            request.session['invite_email'] = om.email

            return self.respond('sentry/accept-organization-invite.html', context)

        if helper.needs_2fa:
            # redirect to setup 2fa
            response = self.respond('sentry/accept-organization-invite.html', context)
            response.set_cookie(PENDING_INVITE, request.path, max_age=COOKIE_MAX_AGE)
            return response

        # if they're already a member of the organization its likely they're
        # using a shared account and either previewing this invite or
        # are incorrectly expecting this to create a new account for them
        context['existing_member'] = helper.member_already_exists

        form = self.get_form(request)
        if form.is_valid():
            helper.accept_invite()

            request.session.pop('can_register', None)
            response = self.redirect(organization.get_absolute_url())
            return helper.remove_invite_cookie(response)

        context['form'] = form
        return self.respond('sentry/accept-organization-invite.html', context)


class BaseInviteHelper(object):
    def __init__(self, instance, request, member_id, token, logger=None):
        self.request = request
        self.instance = instance
        self.member_id = member_id
        self.token = token
        self.logger = logger
        self.om = self.get_organization_member()

    def handle_success(self):
        pass

    def handle_member_already_exists(self):
        pass

    def get_organization_member(self):
        return OrganizationMember.objects.select_related('organization').get(pk=self.member_id)

    @property
    def member_pending(self):
        return self.om.is_pending

    @property
    def valid_token(self):
        if self.om.token_expired:
            return False
        return constant_time_compare(self.om.token or self.om.legacy_token, self.token)

    @property
    def user_authenticated(self):
        return self.request.user.is_authenticated()

    @property
    def needs_2fa(self):
        org_requires_2fa = self.om.organization.flags.require_2fa.is_set
        user_has_2fa = Authenticator.objects.user_has_2fa(self.request.user.id)
        return org_requires_2fa and not user_has_2fa

    @property
    def member_already_exists(self):
        return OrganizationMember.objects.filter(
            organization=self.om.organization, user=self.request.user
        ).exists()

    def accept_invite(self):
        om = self.om

        if self.member_already_exists:
            self.handle_member_already_exists()
            om.delete()
        else:
            om.set_user(self.request.user)
            om.save()

            self.instance.create_audit_entry(
                self.request,
                organization=om.organization,
                target_object=om.id,
                target_user=self.request.user,
                event=AuditLogEntryEvent.MEMBER_ACCEPT,
                data=om.get_audit_log_data(),
            )

            self.handle_success()

    def remove_invite_cookie(self, response):
        if PENDING_INVITE in self.request.COOKIES:
            response.delete_cookie(PENDING_INVITE)
        return response


class WebInviteHelper(BaseInviteHelper):
    def handle_success(self):
        messages.add_message(
            self.request, messages.SUCCESS,
            _('You have been added to the %r organization.') %
            (self.om.organization.name.encode('utf-8'), )
        )

        member_joined.send_robust(
            member=self.om, organization=self.om.organization, sender=self.instance)

    def handle_member_already_exists(self):
        messages.add_message(
            self.request, messages.SUCCESS,
            _('You are already a member of the %r organization.') %
            (self.om.organization.name.encode('utf-8'), )
        )


class ApiInviteHelper(BaseInviteHelper):
    def handle_member_already_exists(self):
        self.logger.info(
            'Pending org invite not accepted - User already org member',
            extra={
                'organization_id': self.om.organization.id,
                'user_id': self.request.user.id,
            }
        )

    def valid_request(self):
        if (not self.member_pending or
            not self.valid_token or
            not self.user_authenticated or
                self.needs_2fa):
            return False
        return True
