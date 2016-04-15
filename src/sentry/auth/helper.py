from __future__ import absolute_import, print_function

import logging

from django.conf import settings
from django.core.urlresolvers import reverse
from django.contrib import messages
from django.db import transaction
from django.http import HttpResponseRedirect
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from hashlib import md5
from uuid import uuid4

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, AuthIdentity, AuthProvider, Organization,
    OrganizationMember, OrganizationMemberTeam, User
)
from sentry.tasks.auth import email_missing_links
from sentry.utils import auth
from sentry.utils.cache import Lock
from sentry.utils.http import absolute_uri
from sentry.web.forms.accounts import AuthenticationForm
from sentry.web.helpers import render_to_response

from . import manager

OK_LINK_IDENTITY = _('You have successully linked your account to your SSO provider.')

OK_SETUP_SSO = _('SSO has been configured for your organization and any existing members have been sent an email to link their accounts.')

ERR_UID_MISMATCH = _('There was an error encountered during authentication.')

ERR_NOT_AUTHED = _('You must be authenticated to link accounts.')


class AuthHelper(object):
    """
    Helper class which is passed into AuthView's.

    Designed to link provider and views as well as manage the state and
    pipeline.

    Auth has several flows:

    1. The user is going through provider setup, thus enforcing that they link
       their current account to the new auth identity.
    2. The user is anonymous and creating a brand new account.
    3. The user is anonymous and logging into an existing account.
    4. The user is anonymous and creating a brand new account, but may have an
       existing account that should/could be merged.
    5. The user is authenticated and creating a new identity, thus associating
       it with their current account.
    6. The user is authenticated and creating a new identity, but not linking
       it with their account (thus creating a new account).
    """
    # logging in or registering
    FLOW_LOGIN = 1
    # configuring the provider
    FLOW_SETUP_PROVIDER = 2

    @classmethod
    def get_for_request(cls, request):
        session = request.session.get('auth', {})
        organization_id = session.get('org')
        if not organization_id:
            logging.info('Invalid SSO data found')
            return None

        flow = session['flow']

        auth_provider_id = session.get('ap')
        provider_key = session.get('p')
        if auth_provider_id:
            auth_provider = AuthProvider.objects.get(
                id=auth_provider_id
            )
        elif provider_key:
            auth_provider = None

        organization = Organization.objects.get(
            id=session['org'],
        )

        return cls(request, organization, flow,
                   auth_provider=auth_provider, provider_key=provider_key)

    def __init__(self, request, organization, flow, auth_provider=None,
                 provider_key=None):
        assert provider_key or auth_provider

        self.request = request
        self.auth_provider = auth_provider
        self.organization = organization
        self.flow = flow

        if auth_provider:
            provider = auth_provider.get_provider()
        elif provider_key:
            provider = manager.get(provider_key)
        else:
            raise NotImplementedError

        self.provider = provider
        if flow == self.FLOW_LOGIN:
            self.pipeline = provider.get_auth_pipeline()
        elif flow == self.FLOW_SETUP_PROVIDER:
            self.pipeline = provider.get_setup_pipeline()
        else:
            raise NotImplementedError

        # we serialize the pipeline to be [AuthView().get_ident(), ...] which
        # allows us to determine if the pipeline has changed during the auth
        # flow or if the user is somehow circumventing a chunk of it
        self.signature = md5(
            ' '.join(av.get_ident() for av in self.pipeline)
        ).hexdigest()

    def pipeline_is_valid(self):
        session = self.request.session.get('auth', {})
        if not session:
            return False
        if session.get('flow') not in (self.FLOW_LOGIN, self.FLOW_SETUP_PROVIDER):
            return False
        return session.get('sig') == self.signature

    def init_pipeline(self):
        session = {
            'uid': self.request.user.id if self.request.user.is_authenticated() else None,
            'ap': self.auth_provider.id if self.auth_provider else None,
            'p': self.provider.key,
            'org': self.organization.id,
            'idx': -1,
            'sig': self.signature,
            'flow': self.flow,
            'state': {},
        }
        self.request.session['auth'] = session
        self.request.session.modified = True

    def get_redirect_url(self):
        return absolute_uri(reverse('sentry-auth-sso'))

    def clear_session(self):
        if 'auth' in self.request.session:
            del self.request.session['auth']
            self.request.session.modified = True

    def current_step(self):
        """
        Render the current step.
        """
        session = self.request.session['auth']
        idx = session['idx']
        if idx == len(self.pipeline):
            return self.finish_pipeline()
        return self.pipeline[idx].dispatch(
            request=self.request,
            helper=self,
        )

    def next_step(self):
        """
        Render the next step.
        """
        self.request.session['auth']['idx'] += 1
        self.request.session.modified = True
        return self.current_step()

    def finish_pipeline(self):
        session = self.request.session['auth']
        state = session['state']
        identity = self.provider.build_identity(state)

        if session['flow'] == self.FLOW_LOGIN:
            # create identity and authenticate the user
            response = self._finish_login_pipeline(identity)
        elif session['flow'] == self.FLOW_SETUP_PROVIDER:
            response = self._finish_setup_pipeline(identity)

        return response

    @transaction.atomic
    def _handle_attach_identity(self, identity, member=None):
        """
        Given an already authenticated user, attach or re-attach and identity.
        """
        auth_provider = self.auth_provider
        request = self.request
        user = request.user
        organization = self.organization

        try:
            auth_identity = AuthIdentity.objects.get(
                auth_provider=auth_provider,
                ident=identity['id'],
            )
        except AuthIdentity.DoesNotExist:
            auth_identity = AuthIdentity.objects.create(
                auth_provider=auth_provider,
                user=user,
                ident=identity['id'],
                data=identity.get('data', {}),
            )
            auth_is_new = True
        else:
            now = timezone.now()
            auth_identity.update(
                user=user,
                data=self.provider.update_identity(
                    new_data=identity.get('data', {}),
                    current_data=auth_identity.data,
                ),
                last_verified=now,
                last_synced=now,
            )
            auth_is_new = False

        if member is None:
            try:
                member = OrganizationMember.objects.get(
                    user=user,
                    organization=organization,
                )
            except OrganizationMember.DoesNotExist:
                member = OrganizationMember.objects.create(
                    organization=organization,
                    role=organization.default_role,
                    user=user,
                    flags=getattr(OrganizationMember.flags, 'sso:linked'),
                )

                default_teams = auth_provider.default_teams.all()
                for team in default_teams:
                    OrganizationMemberTeam.objects.create(
                        team=team,
                        organizationmember=member,
                    )

                AuditLogEntry.objects.create(
                    organization=organization,
                    actor=user,
                    ip_address=request.META['REMOTE_ADDR'],
                    target_object=member.id,
                    target_user=user,
                    event=AuditLogEntryEvent.MEMBER_ADD,
                    data=member.get_audit_log_data(),
                )
        if getattr(member.flags, 'sso:invalid') or not getattr(member.flags, 'sso:linked'):
            setattr(member.flags, 'sso:invalid', False)
            setattr(member.flags, 'sso:linked', True)
            member.save()

        if auth_is_new:
            AuditLogEntry.objects.create(
                organization=organization,
                actor=user,
                ip_address=request.META['REMOTE_ADDR'],
                target_object=auth_identity.id,
                event=AuditLogEntryEvent.SSO_IDENTITY_LINK,
                data=auth_identity.get_audit_log_data(),
            )

            messages.add_message(
                request, messages.SUCCESS,
                OK_LINK_IDENTITY,
            )

        return auth_identity

    def _handle_new_user(self, identity):
        auth_provider = self.auth_provider

        user = User.objects.create(
            username=uuid4().hex,
            email=identity['email'],
            name=identity.get('name', '')[:200],
            is_managed=True,
        )

        auth_identity = AuthIdentity.objects.create(
            auth_provider=auth_provider,
            user=user,
            ident=identity['id'],
            data=identity.get('data', {}),
        )

        self._handle_new_membership(auth_identity)

        return auth_identity

    def _handle_new_membership(self, identity):
        auth_provider = self.auth_provider
        organization = self.organization
        request = self.request
        user = identity.user

        om = OrganizationMember.objects.create(
            organization=organization,
            role=organization.default_role,
            user=user,
            flags=getattr(OrganizationMember.flags, 'sso:linked'),
        )

        default_teams = auth_provider.default_teams.all()
        for team in default_teams:
            OrganizationMemberTeam.objects.create(
                team=team,
                organizationmember=om,
            )

        AuditLogEntry.objects.create(
            organization=organization,
            actor=user,
            ip_address=request.META['REMOTE_ADDR'],
            target_object=om.id,
            target_user=om.user,
            event=AuditLogEntryEvent.MEMBER_ADD,
            data=om.get_audit_log_data(),
        )

        return om

    def _get_login_form(self, existing_user=None):
        request = self.request
        return AuthenticationForm(
            request,
            request.POST if request.POST.get('op') == 'login' else None,
            initial={
                'username': existing_user.username if existing_user else None,
            },
            captcha=bool(request.session.get('needs_captcha')),
        )

    def _get_display_name(self, identity):
        return identity.get('name') or identity.get('email')

    def _get_identifier(self, identity):
        return identity.get('email') or identity.get('id')

    def _handle_unknown_identity(self, identity):
        """
        Flow is activated upon a user logging in to where an AuthIdentity is
        not present.

        The flow will attempt to answer the following:

        - Is there an existing user with the same email address? Should they be
          merged?

        - Is there an existing user (via authentication) that shoudl be merged?

        - Should I create a new user based on this identity?
        """
        request = self.request
        op = request.POST.get('op')
        if not request.user.is_authenticated():
            try:
                existing_user = auth.find_users(identity['email'])[0]
            except IndexError:
                existing_user = None
            login_form = self._get_login_form(existing_user)

        if op == 'confirm' and request.user.is_authenticated():
            auth_identity = self._handle_attach_identity(identity)
        elif op == 'newuser':
            auth_identity = self._handle_new_user(identity)
        elif op == 'login' and not request.user.is_authenticated():
            # confirm authentication, login
            op = None
            if login_form.is_valid():
                auth.login(request, login_form.get_user())
                request.session.pop('needs_captcha', None)
            else:
                auth.log_auth_failure(request, request.POST.get('username'))
                request.session['needs_captcha'] = 1
        else:
            op = None

        if not op:
            if request.user.is_authenticated():
                return self.respond('sentry/auth-confirm-link.html', {
                    'identity': identity,
                    'existing_user': request.user,
                    'identity_display_name': self._get_display_name(identity),
                    'identity_identifier': self._get_identifier(identity)
                })

            return self.respond('sentry/auth-confirm-identity.html', {
                'existing_user': existing_user,
                'identity': identity,
                'login_form': login_form,
                'identity_display_name': self._get_display_name(identity),
                'identity_identifier': self._get_identifier(identity)
            })

        user = auth_identity.user
        user.backend = settings.AUTHENTICATION_BACKENDS[0]

        auth.login(self.request, user)

        self.clear_session()

        return HttpResponseRedirect(auth.get_login_redirect(self.request))

    def _handle_existing_identity(self, auth_identity, identity):
        # TODO(dcramer): this is very similar to attach
        now = timezone.now()
        auth_identity.update(
            data=self.provider.update_identity(
                new_data=identity.get('data', {}),
                current_data=auth_identity.data,
            ),
            last_verified=now,
            last_synced=now,
        )

        try:
            member = OrganizationMember.objects.get(
                user=auth_identity.user,
                organization=self.organization,
            )
        except OrganizationMember.DoesNotExist:
            # this is likely the case when someone was removed from the org
            # but still has access to rejoin
            member = self._handle_new_membership(auth_identity)
        else:
            if getattr(member.flags, 'sso:invalid') or not getattr(member.flags, 'sso:linked'):
                setattr(member.flags, 'sso:invalid', False)
                setattr(member.flags, 'sso:linked', True)
                member.save()

        user = auth_identity.user
        user.backend = settings.AUTHENTICATION_BACKENDS[0]

        auth.login(self.request, user)

        self.clear_session()

        return HttpResponseRedirect(auth.get_login_redirect(self.request))

    @transaction.atomic
    def _finish_login_pipeline(self, identity):
        """
        The login flow executes both with anonymous and authenticated users.

        Upon completion a few branches exist:

        If the identity is already linked, the user should be logged in
        and redirected immediately.

        Otherwise, the user is presented with a confirmation window. That window
        will show them the new account that will be created, and if they're
        already authenticated an optional button to associate the identity with
        their account.
        """
        auth_provider = self.auth_provider
        lock_key = 'sso:auth:{}:{}'.format(
            auth_provider.id,
            md5(unicode(identity['id'])).hexdigest(),
        )
        with Lock(lock_key, timeout=5):
            try:
                auth_identity = AuthIdentity.objects.get(
                    auth_provider=auth_provider,
                    ident=identity['id'],
                )
            except AuthIdentity.DoesNotExist:
                return self._handle_unknown_identity(identity)
            return self._handle_existing_identity(auth_identity, identity)

    @transaction.atomic
    def _finish_setup_pipeline(self, identity):
        """
        The setup flow creates the auth provider as well as an identity linked
        to the active user.
        """
        request = self.request
        if not request.user.is_authenticated():
            return self.error(ERR_NOT_AUTHED)

        if request.user.id != request.session['auth']['uid']:
            return self.error(ERR_UID_MISMATCH)

        state = request.session['auth']['state']
        config = self.provider.build_config(state)

        try:
            om = OrganizationMember.objects.get(
                user=request.user,
                organization=self.organization,
            )
        except OrganizationMember.DoesNotExist:
            return self.error(ERR_UID_MISMATCH)

        self.auth_provider = AuthProvider.objects.create(
            organization=self.organization,
            provider=self.provider.key,
            config=config,
        )

        self._handle_attach_identity(identity, om)

        AuditLogEntry.objects.create(
            organization=self.organization,
            actor=request.user,
            ip_address=request.META['REMOTE_ADDR'],
            target_object=self.auth_provider.id,
            event=AuditLogEntryEvent.SSO_ENABLE,
            data=self.auth_provider.get_audit_log_data(),
        )

        email_missing_links.delay(
            organization_id=self.organization.id,
        )

        messages.add_message(
            self.request, messages.SUCCESS,
            OK_SETUP_SSO,
        )

        self.clear_session()

        next_uri = reverse('sentry-organization-auth-settings', args=[
            self.organization.slug,
        ])
        return HttpResponseRedirect(next_uri)

    def respond(self, template, context=None, status=200):
        default_context = {
            'organization': self.organization,
        }
        if context:
            default_context.update(context)

        return render_to_response(template, default_context, self.request,
                                  status=status)

    def error(self, message):
        session = self.request.session['auth']
        if session['flow'] == self.FLOW_LOGIN:
            # create identity and authenticate the user
            redirect_uri = reverse('sentry-auth-organization', args=[self.organization.slug])

        elif session['flow'] == self.FLOW_SETUP_PROVIDER:
            redirect_uri = reverse('sentry-organization-auth-settings', args=[self.organization.slug])

        messages.add_message(
            self.request, messages.ERROR,
            u'Authentication error: {}'.format(message),
        )

        return HttpResponseRedirect(redirect_uri)

    def bind_state(self, key, value):
        self.request.session['auth']['state'][key] = value
        self.request.session.modified = True

    def fetch_state(self, key):
        return self.request.session['auth']['state'].get(key)
