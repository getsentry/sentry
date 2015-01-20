from __future__ import absolute_import, print_function

import logging

from django.core.urlresolvers import reverse
from hashlib import md5

from sentry.models import AuthProvider, Organization


class AuthHelper(object):
    """
    Helper class which is passed into AuthView's.

    Designed to link provider and views as well as manage the state and
    pipeline.
    """
    @classmethod
    def get_for_request(cls, request):
        session = request.session.get('auth', {})
        auth_provider_id = session.get('ap')
        if not auth_provider_id:
            logging.info('Invalid SSO data found')
            return None

        auth_provider = AuthProvider.objects.get(
            id=auth_provider_id
        )
        organization = Organization.objects.get_from_cache(
            id=session['org'],
        )

        return cls(request, organization, auth_provider)

    def __init__(self, request, organization, auth_provider):
        self.request = request
        self.auth_provider = auth_provider
        self.organization = organization

        provider = auth_provider.get_provider()(
            key=auth_provider.provider,
            **auth_provider.config
        )

        self.provider = provider
        self.pipeline = provider.get_auth_pipeline()
        # we serialize the pipeline to be [AuthView().get_ident(), ...] which
        # allows us to determine if the pipeline has changed during the auth
        # flow or if the user is somehow circumventing a chunk of it
        self.signature = md5(' '.join(av.get_ident() for av in self.pipeline)).hexdigest()

    def pipeline_is_valid(self):
        session = self.request.session.get('auth', {})
        if not session:
            return False
        return session.get('sig') == self.signature

    def reset_pipeline(self):
        session = {
            'ap': self.auth_provider.id,
            'org': self.organization.id,
            'idx': -1,
            'sig': self.signature,
            'state': {},
        }
        self.request.session['auth'] = session
        self.request.session.is_modified = True

    def get_current_view(self):
        idx = self.request.session['auth']['idx']
        return self.pipeline[idx]

    def get_next_url(self):
        return self.request.build_absolute_uri(reverse('sentry-auth-sso'))

    def get_current_url(self):
        return self.request.build_absolute_uri(reverse('sentry-auth-sso'))

    def next_step(self):
        # TODO: this needs to somehow embed the next step
        # (it shouldnt force an exteneral redirect)
        session = self.request.session['auth']
        session['idx'] += 1
        self.request.session.is_modified = True

        idx = session['idx']
        if idx == len(self.pipeline):
            identity = self.provider.get_identity(session.get('state', {}))
            raise NotImplementedError

        return self.pipeline[idx].dispatch(self.request, self)

    def error(self, message):
        raise Exception(message)

    def bind_state(self, key, value):
        self.request.session['auth']['state'][key] = value
        self.request.session.is_modified = True

    def fetch_state(self, key):
        return self.request.session['auth']['state'].get(key)
