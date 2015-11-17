from __future__ import absolute_import, print_function

import logging

from django.conf import settings
from django.core.urlresolvers import reverse
from django.contrib import messages
from django.contrib.auth import login
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
from sentry.utils.auth import get_login_redirect
from sentry.utils.http import absolute_uri
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
    # linking an identity to an existing account
    FLOW_LINK_IDENTITY = 3

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
        if flow in (self.FLOW_LOGIN, self.FLOW_LINK_IDENTITY):
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
        elif session['flow'] == self.FLOW_LINK_IDENTITY:
            # create identity and authenticate the user
            response = self._finish_link_pipeline(identity)

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
                data=identity.get('data', {}),
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
            first_name=identity.get('name', ''),
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
            om.teams.add(team)

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
        request = self.request

        # TODO(dcramer): check for an existing user with the given email address
        # and if one exists, ask them to verify the account for merge

        try:
            auth_identity = AuthIdentity.objects.get(
                auth_provider=auth_provider,
                ident=identity['id'],
            )
        except AuthIdentity.DoesNotExist:
            if request.POST.get('op') == 'confirm' and request.user.is_authenticated():
                auth_identity = self._handle_attach_identity(identity)
            elif request.POST.get('op') == 'newuser':
                auth_identity = self._handle_new_user(identity)
            else:
                if request.user.is_authenticated():
                    return self.respond('sentry/auth-confirm-link.html', {
                        'identity': identity,
                    })
                return self.respond('sentry/auth-confirm-identity.html', {
                    'identity': identity,
                })
        else:
            # TODO(dcramer): this is very similar to attach
            now = timezone.now()
            auth_identity.update(
                data=identity.get('data', {}),
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

        login(self.request, user)

        self.clear_session()

        return HttpResponseRedirect(get_login_redirect(self.request))

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

        member_list = OrganizationMember.objects.filter(
            organization=self.organization,
            flags=~getattr(OrganizationMember.flags, 'sso:linked'),
        )
        for member in member_list:
            member.send_sso_link_email()

        messages.add_message(
            self.request, messages.SUCCESS,
            OK_SETUP_SSO,
        )

        self.clear_session()

        next_uri = reverse('sentry-organization-auth-settings', args=[
            self.organization.slug,
        ])
        return HttpResponseRedirect(next_uri)

    @transaction.atomic
    def _finish_link_pipeline(self, identity):
        """
        The link flow shows the user a confirmation of the link that is about
        to be created, and upon confirmation associates the identity.
        """
        request = self.request
        if not request.user.is_authenticated():
            return self.error(ERR_NOT_AUTHED)

        if request.user.id != request.session['auth']['uid']:
            return self.error(ERR_UID_MISMATCH)

        if request.POST.get('op') == 'confirm':
            self._handle_attach_identity(identity)
        elif request.POST.get('op') == 'newuser':
            auth_identity = self._handle_new_user(identity)

            user = auth_identity.user
            user.backend = settings.AUTHENTICATION_BACKENDS[0]

            login(self.request, user)
        else:
            return self.respond('sentry/auth-confirm-link.html', {
                'identity': identity,
            })

        self.clear_session()

        next_uri = reverse('sentry-organization-home', args=[
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

        elif session['flow'] == self.FLOW_LINK_IDENTITY:
            redirect_uri = reverse('sentry-auth-organization', args=[self.organization.slug])

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
