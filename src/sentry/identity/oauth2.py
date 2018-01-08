from __future__ import absolute_import, print_function

__all__ = ['OAuth2Provider', 'OAuth2CallbackView', 'OAuth2LoginView']

from six.moves.urllib.parse import parse_qsl, urlencode
from uuid import uuid4
from time import time

from sentry.http import safe_urlopen, safe_urlread
from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry.utils.pipeline import PipelineView

from .base import Provider

ERR_INVALID_STATE = 'An error occurred while validating your request.'


class OAuth2Provider(Provider):
    """
    The OAuth2Provider is a generic way to implement an identity provider that
    uses the OAuth 2.0 protocol as a means for authenticating a user.

    OAuth scopes are configured through the oauth_scopes class property,
    however may be overriden using the ``config['oauth_scopes']`` object.
    """
    oauth_access_token_url = ''
    oauth_authorize_url = ''
    refresh_token_url = ''

    oauth_scopes = ()

    def get_oauth_client_id(self):
        raise NotImplementedError

    def get_oauth_client_secret(self):
        raise NotImplementedError

    def get_oauth_scopes(self):
        return self.config.get('oauth_scopes', self.oauth_scopes)

    def get_pipeline_views(self):
        return [
            OAuth2LoginView(
                authorize_url=self.oauth_authorize_url,
                client_id=self.get_oauth_client_id(),
                scope=' '.join(self.get_oauth_scopes()),
            ),
            OAuth2CallbackView(
                access_token_url=self.oauth_access_token_url,
                client_id=self.get_oauth_client_id(),
                client_secret=self.get_oauth_client_secret(),
            ),
        ]

    def get_oauth_data(self, payload):
        data = {'access_token': payload['access_token']}

        if 'expires_in' in payload:
            data['expires'] = int(time()) + payload['expires_in']
        if 'refresh_token' in payload:
            data['refresh_token'] = payload['refresh_token']
        if 'token_type' in payload:
            data['token_type'] = payload['token_type']

        return data


class OAuth2LoginView(PipelineView):
    authorize_url = None
    client_id = None
    scope = ''

    def __init__(self, authorize_url=None, client_id=None, scope=None, *args, **kwargs):
        super(OAuth2LoginView, self).__init__(*args, **kwargs)
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
            'client_id': self.client_id,
            'response_type': "code",
            'scope': self.get_scope(),
            'state': state,
            'redirect_uri': redirect_uri,
        }

    def dispatch(self, request, pipeline):
        if 'code' in request.GET:
            return pipeline.next_step()

        state = uuid4().hex

        params = self.get_authorize_params(
            state=state,
            redirect_uri=absolute_uri(pipeline.redirect_url()),
        )
        redirect_uri = '{}?{}'.format(self.get_authorize_url(), urlencode(params))

        pipeline.bind_state('state', state)

        return self.redirect(redirect_uri)


class OAuth2CallbackView(PipelineView):
    access_token_url = None
    client_id = None
    client_secret = None

    def __init__(self, access_token_url=None, client_id=None, client_secret=None, *args, **kwargs):
        super(OAuth2CallbackView, self).__init__(*args, **kwargs)
        if access_token_url is not None:
            self.access_token_url = access_token_url
        if client_id is not None:
            self.client_id = client_id
        if client_secret is not None:
            self.client_secret = client_secret

    def get_token_params(self, code, redirect_uri):
        return {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': redirect_uri,
            'client_id': self.client_id,
            'client_secret': self.client_secret,
        }

    def exchange_token(self, request, pipeline, code):
        # TODO: this needs the auth yet
        data = self.get_token_params(
            code=code,
            redirect_uri=absolute_uri(pipeline.redirect_url()),
        )
        req = safe_urlopen(self.access_token_url, data=data)
        body = safe_urlread(req)
        if req.headers['Content-Type'].startswith('application/x-www-form-urlencoded'):
            return dict(parse_qsl(body))
        return json.loads(body)

    def dispatch(self, request, pipeline):
        error = request.GET.get('error')
        state = request.GET.get('state')
        code = request.GET.get('code')

        if error:
            pipeline.logger.info('identity.token-exchange-error', extra={'error': error})
            return pipeline.error(error)

        if state != pipeline.fetch_state('state'):
            pipeline.logger.info('identity.token-exchange-error', extra={'error': 'invalid_state'})
            return pipeline.error(ERR_INVALID_STATE)

        data = self.exchange_token(request, pipeline, code)

        if 'error_description' in data:
            error = data.get('error')
            pipeline.logger.info('identity.token-exchange-error', extra={'error': error})
            return pipeline.error(data['error_description'])

        if 'error' in data:
            pipeline.logger.info('identity.token-exchange-error', extra={'error': data['error']})
            return pipeline.error('Failed to retrieve toek from the upstream service.')

        # we can either expect the API to be implicit and say "im looking for
        # blah within state data" or we need to pass implementation + call a
        # hook here
        pipeline.bind_state('data', data)

        return pipeline.next_step()
