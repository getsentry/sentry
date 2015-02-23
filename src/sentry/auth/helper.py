from __future__ import absolute_import, print_function

import logging

from django.conf import settings
from django.db import transaction
from django.http import HttpResponseRedirect
from django.contrib.auth import login
from django.core.urlresolvers import reverse
from hashlib import md5

from sentry.models import (
    AuthIdentity, AuthProvider, Organization, OrganizationMember, User
)
from sentry.utils.auth import get_login_redirect

from . import manager


class AuthHelper(object):
    """
    Helper class which is passed into AuthView's.

    Designed to link provider and views as well as manage the state and
    pipeline.
    """
    FLOW_LOGIN = 1
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
        return session.get('sig') == self.signature

    def init_pipeline(self):
        session = {
            'ap': self.auth_provider.id if self.auth_provider else None,
            'p': self.provider.key,
            'org': self.organization.id,
            'idx': -1,
            'sig': self.signature,
            'flow': self.flow,
            'state': {},
        }
        self.request.session['auth'] = session
        self.request.session.is_modified = True

    def get_current_view(self):
        idx = self.request.session['auth']['idx']
        return self.pipeline[idx]

    def get_redirect_url(self):
        return self.request.build_absolute_uri(reverse('sentry-auth-sso'))

    def next_step(self):
        # TODO: this needs to somehow embed the next step
        # (it shouldnt force an exteneral redirect)
        session = self.request.session['auth']
        session['idx'] += 1
        self.request.session.is_modified = True

        idx = session['idx']
        if idx == len(self.pipeline):
            return self.finish_pipeline()

        return self.pipeline[idx].dispatch(self.request, self)

    def finish_pipeline(self):
        session = self.request.session['auth']
        state = session['state']
        identity = self.provider.build_identity(state)

        if session['flow'] == self.FLOW_LOGIN:
            # create identity and authenticate the user
            response = self._finish_login_pipeline(identity)
        elif session['flow'] == self.FLOW_SETUP_PROVIDER:
            response = self._finish_setup_pipeline(identity)

        del self.request.session['auth']
        self.request.session.is_modified = True

        return response

    def _finish_login_pipeline(self, identity):
        auth_provider = self.auth_provider

        with transaction.atomic():
            try:
                auth_identity = AuthIdentity.objects.get(
                    auth_provider=auth_provider,
                    ident=identity['id'],
                )
            except AuthIdentity.DoesNotExist:
                user = User.objects.create(
                    email=identity['email'],
                    first_name=identity.get('name'),
                    is_managed=True,
                )

                AuthIdentity.objects.create(
                    auth_provider=auth_provider,
                    user=user,
                    ident=identity['id'],
                )

                OrganizationMember.objects.create(
                    has_global_access=True,
                    organization=self.organization,
                    type=auth_provider.default_role,
                    user=user,
                )
            else:
                if auth_identity.data != identity.get('data', {}):
                    auth_identity.update(data=identity['data'])

        user = auth_identity.user
        user.backend = settings.AUTHENTICATION_BACKENDS[0]

        login(self.request, user)

        return HttpResponseRedirect(get_login_redirect(self.request))

    def _finish_setup_pipeline(self, identity):
        state = self.request.session['auth']['state']
        config = self.provider.build_config(state)
        with transaction.atomic():
            self.auth_provider = AuthProvider.objects.create(
                organization=self.organization,
                provider=self.provider.key,
                config=config,
            )

            AuthIdentity.objects.create_or_update(
                user=self.request.user,
                ident=identity['id'],
                auth_provider=self.auth_provider,
                defaults={
                    'data': identity.get('data', {}),
                },
            )

        next_uri = reverse('sentry-organization-auth-settings', args=[
            self.organization.slug,
        ])
        return HttpResponseRedirect(next_uri)

    def error(self, message):
        # TODO
        raise Exception(message)

    def bind_state(self, key, value):
        self.request.session['auth']['state'][key] = value
        self.request.session.is_modified = True

    def fetch_state(self, key):
        return self.request.session['auth']['state'].get(key)
