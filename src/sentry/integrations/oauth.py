from __future__ import absolute_import, print_function

__all__ = ['OAuth2Integration', 'OAuth2CallbackView', 'OAuth2LoginView']

from six.moves.urllib.parse import parse_qsl, urlencode
from uuid import uuid4

from sentry.http import safe_urlopen, safe_urlread
from sentry.utils import json
from sentry.utils.http import absolute_uri

from .base import Integration
from .view import PipelineView

ERR_INVALID_STATE = 'An error occurred while validating your request.'


class OAuth2Integration(Integration):
    oauth_access_token_url = ''
    oauth_authorize_url = ''
    oauth_client_id = ''
    oauth_client_secret = ''
    oauth_refresh_token_url = ''
    oauth_scopes = ()

    def is_configured(self):
        return (
            self.get_oauth_client_id() and
            self.get_oauth_client_secret() and
            self.get_oauth_access_token_url() and
            self.get_oauth_authorize_url()
        )

    def get_oauth_client_id(self):
        return self.oauth_client_id

    def get_oauth_client_secret(self):
        return self.oauth_client_secret

    def get_oauth_access_token_url(self):
        return self.oauth_access_token_url

    def get_oauth_authorize_url(self):
        return self.oauth_authorize_url

    def get_oauth_refresh_token_url(self):
        return self.oauth_refresh_token_url

    def get_oauth_scopes(self):
        return self.oauth_scopes

    def get_pipeline(self):
        return [
            OAuth2LoginView(
                authorize_url=self.get_oauth_authorize_url(),
                client_id=self.get_oauth_client_id(),
                scope=' '.join(self.get_oauth_scopes()),
            ),
            OAuth2CallbackView(
                access_token_url=self.get_oauth_access_token_url(),
                client_id=self.get_oauth_client_id(),
                client_secret=self.get_oauth_client_secret(),
            ),
        ]


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

    def dispatch(self, request, helper):
        if 'code' in request.GET:
            return helper.next_step()

        state = uuid4().hex

        params = self.get_authorize_params(
            state=state,
            redirect_uri=absolute_uri(helper.get_redirect_url()),
        )
        redirect_uri = '{}?{}'.format(self.get_authorize_url(), urlencode(params))

        helper.bind_state('state', state)

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
            helper.logger.info('auth.token-exchange-error', extra={
                'error': error,
            })
            return helper.error(error)

        if state != helper.fetch_state('state'):
            helper.logger.info('auth.token-exchange-error', extra={
                'error': 'invalid_state',
            })
            return helper.error(ERR_INVALID_STATE)

        data = self.exchange_token(request, helper, code)

        if 'error_description' in data:
            helper.logger.info('auth.token-exchange-error', extra={
                'error': data.get('error'),
            })
            return helper.error(data['error_description'])

        if 'error' in data:
            helper.logger.info('auth.token-exchange-error', extra={
                'error': data['error'],
            })
            return helper.error(
                'There was an error when retrieving a token from the upstream service.')

        # we can either expect the API to be implicit and say "im looking for
        # blah within state data" or we need to pass implementation + call a
        # hook here
        helper.bind_state('data', data)

        return helper.next_step()
