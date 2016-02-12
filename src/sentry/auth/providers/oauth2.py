from __future__ import absolute_import, print_function

import logging

from time import time
from urllib import urlencode
from urlparse import parse_qsl
from uuid import uuid4

from sentry.auth import Provider, AuthView
from sentry.auth.exceptions import IdentityNotValid
from sentry.http import safe_urlopen, safe_urlread
from sentry.utils import json
from sentry.utils.http import absolute_uri

ERR_INVALID_STATE = 'An error occurred while validating your request.'


class OAuth2Login(AuthView):
    authorize_url = None
    client_id = None
    scope = ''

    def __init__(self, authorize_url=None, client_id=None, scope=None, *args,
                 **kwargs):
        super(OAuth2Login, self).__init__(*args, **kwargs)
        if authorize_url is not None:
            self.authorize_url = authorize_url
        if client_id is not None:
            self.client_id = client_id
        if scope is not None:
            self.scope = scope

    def get_scope(self):
        return self.scope

    def get_authorize_url(self):
        return self.authorize_url

    def get_authorize_params(self, state, redirect_uri):
        return {
            "client_id": self.client_id,
            "response_type": "code",
            "scope": self.get_scope(),
            "state": state,
            "redirect_uri": redirect_uri,
        }

    def dispatch(self, request, helper):
        if 'code' in request.GET:
            return helper.next_step()

        state = str(uuid4())

        params = self.get_authorize_params(
            state=state,
            redirect_uri=absolute_uri(helper.get_redirect_url()),
        )
        redirect_uri = '{}?{}'.format(
            self.get_authorize_url(), urlencode(params)
        )

        helper.bind_state('state', state)

        return self.redirect(redirect_uri)


class OAuth2Callback(AuthView):
    access_token_url = None
    client_id = None
    client_secret = None

    def __init__(self, access_token_url=None, client_id=None,
                 client_secret=None, *args, **kwargs):
        super(OAuth2Callback, self).__init__(*args, **kwargs)
        if access_token_url is not None:
            self.access_token_url = access_token_url
        if client_id is not None:
            self.client_id = client_id
        if client_secret is not None:
            self.client_secret = client_secret

    def get_token_params(self, code, redirect_uri):
        return {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

    def exchange_token(self, request, helper, code):
        # TODO: this needs the auth yet
        data = self.get_token_params(
            code=code,
            redirect_uri=absolute_uri(helper.get_redirect_url()),
        )
        req = safe_urlopen(self.access_token_url, data=data)
        body = safe_urlread(req)
        if req.headers['Content-Type'].startswith('application/x-www-form-urlencoded'):
            return dict(parse_qsl(body))
        return json.loads(body)

    def dispatch(self, request, helper):
        error = request.GET.get('error')
        state = request.GET.get('state')
        code = request.GET.get('code')

        if error:
            return helper.error(error)

        if state != helper.fetch_state('state'):
            return helper.error(ERR_INVALID_STATE)

        data = self.exchange_token(request, helper, code)

        if 'error_description' in data:
            return helper.error(data['error_description'])

        if 'error' in data:
            logging.info('Error exchanging token: %s', data['error'])
            return helper.error('Unable to retrieve your token')

        # we can either expect the API to be implicit and say "im looking for
        # blah within state data" or we need to pass implementation + call a
        # hook here
        helper.bind_state('data', data)

        return helper.next_step()


class OAuth2Provider(Provider):
    client_id = None
    client_secret = None

    def get_auth_pipeline(self):
        return [
            OAuth2Login(
                client_id=self.client_id,
            ),
            OAuth2Callback(
                client_id=self.client_id,
                client_secret=self.client_secret,
            ),
        ]

    def get_refresh_token_url(self):
        raise NotImplementedError

    def get_refresh_token_params(self, refresh_token):
        return {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }

    def get_oauth_data(self, payload):
        data = {
            'access_token': payload['access_token'],
            'token_type': payload['token_type'],
        }
        if 'expires_in' in payload:
            data['expires'] = time() + payload['expires_in']
        if 'refresh_token' in payload:
            data['refresh_token'] = payload['refresh_token']
        return data

    def build_identity(self, state):
        # data = state['data']
        # return {
        #     'id': '',
        #     'email': '',
        #     'name': '',
        #     'data': self.get_oauth_data(data),
        # }
        raise NotImplementedError

    def update_identity(self, new_data, current_data):
        # we want to maintain things like refresh_token that might not
        # exist on a refreshed state
        if 'refresh_token' in current_data:
            new_data.setdefault('refresh_token', current_data['refresh_token'])
        return new_data

    def refresh_identity(self, auth_identity):
        refresh_token = auth_identity.data.get('refresh_token')

        if not refresh_token:
            raise IdentityNotValid('Missing refresh token')

        data = self.get_refresh_token_params(
            refresh_token=refresh_token,
        )
        req = safe_urlopen(self.get_refresh_token_url(), data=data)

        try:
            body = safe_urlread(req)
            payload = json.loads(body)
        except Exception:
            payload = {}

        error = payload.get('error', 'unknown_error')
        error_description = payload.get('error_description', 'no description available')

        formatted_error = 'HTTP {} ({}): {}'.format(
            req.status_code, error, error_description
        )

        if req.status_code == 401:
            raise IdentityNotValid(formatted_error)

        if req.status_code == 400:
            # this may not be common, but at the very least Google will return
            # an invalid grant when a user is suspended
            if error == 'invalid_grant':
                raise IdentityNotValid(formatted_error)

        if req.status_code != 200:
            raise Exception(formatted_error)

        auth_identity.data.update(self.get_oauth_data(payload))
        auth_identity.update(data=auth_identity.data)
