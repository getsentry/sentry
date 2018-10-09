from __future__ import absolute_import

import logging
import json
import requests

from collections import OrderedDict

from BeautifulSoup import BeautifulStoneSoup
from requests.exceptions import ConnectionError, HTTPError
from time import time
from django.utils.functional import cached_property

from sentry.http import build_session
from sentry.models import Identity, Integration
from sentry.identity import get as get_identity_provider

from .exceptions import ApiHostError, ApiError, UnsupportedResponseType


class BaseApiResponse(object):
    text = ''

    def __init__(self, headers=None, status_code=None):
        self.headers = headers
        self.status_code = status_code

    def __repr__(self):
        return u'<%s: code=%s, content_type=%s>' % (
            type(self).__name__,
            self.status_code,
            self.headers.get('Content-Type', '') if self.headers else '',
        )

    @cached_property
    def rel(self):
        if not self.headers:
            return {}
        link_header = self.headers.get('Link')
        if not link_header:
            return {}
        return {item['rel']: item['url'] for item in requests.utils.parse_header_links(link_header)}

    @classmethod
    def from_response(self, response, allow_text=False):
        # XXX(dcramer): this doesnt handle leading spaces, but they're not common
        # paths so its ok
        if response.text.startswith(u'<?xml'):
            return XmlApiResponse(response.text, response.headers, response.status_code)
        elif response.text.startswith('<'):
            if not allow_text:
                raise ValueError(u'Not a valid response type: {}'.format(response.text[:128]))
            elif response.status_code < 200 or response.status_code >= 300:
                raise ValueError(u'Received unexpected plaintext response for code {}'.format(
                    response.status_code,
                ))
            return TextApiResponse(response.text, response.headers, response.status_code)

        # Some APIs will return JSON with an invalid content-type, so we try
        # to decode it anyways
        if 'application/json' not in response.headers['Content-Type']:
            try:
                data = json.loads(response.text, object_pairs_hook=OrderedDict)
            except (TypeError, ValueError):
                if allow_text:
                    return TextApiResponse(response.text, response.headers, response.status_code)
                raise UnsupportedResponseType(
                    response.headers['Content-Type'], response.status_code)
        else:
            data = json.loads(response.text, object_pairs_hook=OrderedDict)

        if isinstance(data, dict):
            return MappingApiResponse(data, response.headers, response.status_code)
        elif isinstance(data, (list, tuple)):
            return SequenceApiResponse(data, response.headers, response.status_code)
        else:
            raise NotImplementedError


class TextApiResponse(BaseApiResponse):
    def __init__(self, text, *args, **kwargs):
        self.text = text
        super(TextApiResponse, self).__init__(*args, **kwargs)


class XmlApiResponse(BaseApiResponse):
    def __init__(self, text, *args, **kwargs):
        self.xml = BeautifulStoneSoup(text)
        super(XmlApiResponse, self).__init__(*args, **kwargs)


class MappingApiResponse(dict, BaseApiResponse):
    def __init__(self, data, *args, **kwargs):
        dict.__init__(self, data)
        BaseApiResponse.__init__(self, *args, **kwargs)

    @property
    def json(self):
        return self


class SequenceApiResponse(list, BaseApiResponse):
    def __init__(self, data, *args, **kwargs):
        list.__init__(self, data)
        BaseApiResponse.__init__(self, *args, **kwargs)

    @property
    def json(self):
        return self


class ApiClient(object):
    base_url = None

    allow_text = False

    allow_redirects = None

    logger = logging.getLogger('sentry.plugins')

    def __init__(self, verify_ssl=True):
        self.verify_ssl = verify_ssl

    def build_url(self, path):
        if path.startswith('/'):
            if not self.base_url:
                raise ValueError(u'Invalid URL: {}'.format(path))
            return u'{}{}'.format(self.base_url, path)
        return path

    def _request(self, method, path, headers=None, data=None, params=None,
                 auth=None, json=True, allow_text=None, allow_redirects=None,
                 timeout=None):

        if allow_text is None:
            allow_text = self.allow_text

        if allow_redirects is None:
            allow_redirects = self.allow_redirects

        if allow_redirects is None:  # is still None
            allow_redirects = method.upper() == 'GET'

        if timeout is None:
            timeout = 30

        full_url = self.build_url(path)
        session = build_session()
        try:
            resp = getattr(session, method.lower())(
                url=full_url,
                headers=headers,
                json=data if json else None,
                data=data if not json else None,
                params=params,
                auth=auth,
                verify=self.verify_ssl,
                allow_redirects=allow_redirects,
                timeout=timeout,
            )
            resp.raise_for_status()
        except ConnectionError as e:
            raise ApiHostError.from_exception(e)
        except HTTPError as e:
            resp = e.response
            if resp is None:
                self.logger.exception('request.error', extra={
                    'url': full_url,
                })
                raise ApiError('Internal Error')
            raise ApiError.from_response(resp)

        if resp.status_code == 204:
            return {}

        return BaseApiResponse.from_response(resp, allow_text=allow_text)

    # subclasses should override ``request``
    def request(self, *args, **kwargs):
        return self._request(*args, **kwargs)

    def delete(self, *args, **kwargs):
        return self.request('DELETE', *args, **kwargs)

    def get(self, *args, **kwargs):
        return self.request('GET', *args, **kwargs)

    def patch(self, *args, **kwargs):
        return self.request('PATCH', *args, **kwargs)

    def post(self, *args, **kwargs):
        return self.request('POST', *args, **kwargs)

    def put(self, *args, **kwargs):
        return self.request('PUT', *args, **kwargs)


class ClientTokenRefresh(object):
    """
    ClientTokenRefresh provides generic functionality to refresh Identity and
    Integration access tokens for integration API clients.

    Not all integrations will need this as some use non-expiring tokens.
    """
    @classmethod
    def check_auth(cls, model, force_refresh=False, refresh_strategy=None, **kwargs):
        """
        Check auth provides a generic yet configurable way to refresh oauth2
        style authentication tokens.

        Depending on the model passed different strategies will be used to
        refresh the token.

        - Identity
          When an Identity model is provided, the token will be refreshed using
          the identity providers `refresh_identity` method. Updating and
          returning the identity model.

        - Integration
          When an Integration model is provided, the token will be refreshed
          using the identity provider associated to the integrations
          `refresh_oauth_data` method the token, however the access token
          will be persisted on the integration model. The integration model
          will be returned.

        If the token should not be refreshed using the identity providers
        `refresh_oauth_data` capabilities, a custom refresh strategy can be
        provided.

        By default this will check the ``exipred_at`` key, which is expected to
        be a unix timestamp, with the current time. If you wish to force access
        token refreshing (or require a different strategy for comparing
        expires_at) you may pass ``force_refresh=True``.
        """
        if isinstance(model, Identity):
            oauth_data = model.data
            strategy = cls.strategy_identity_refresh
        elif isinstance(model, Integration):
            oauth_data = model.metadata
            strategy = cls.strategy_integration_oauth_refresh

        # Use a default strategy for the provided model if no custom strategy
        # is provided
        if refresh_strategy is None:
            refresh_strategy = strategy

        expires_at = oauth_data.get('expires_at')

        # If we have no expires_at time then we should immedaitely try and refresh
        # the token. This is likely due to integrations such as slack that
        # previosuly did *not* have expiring tokens, or integrations that
        # previously set a 'expires' isntead of 'expires_at' key.
        if expires_at is None:
            force_refresh = True

        if force_refresh or int(expires_at) <= int(time()):
            return refresh_strategy(model, **kwargs)

        return model

    @staticmethod
    def strategy_identity_refresh(identity, **kwargs):
        """
        Refresh the token on the identity model.
        """
        return identity.get_provider().refresh_identity(identity, **kwargs)

    @staticmethod
    def strategy_integration_oauth_refresh(integration, **kwargs):
        """
        Refresh the token on the integration model using the associated
        IdentityProvider. This requires that an integration uses the same key
        as a registered IdentityProvider.
        """
        # XXX: We're explicitly looking for the identity provider with the same
        # provider key as the integration. This makes the assumption that the
        # integration is using the identity provider for auth.
        ident_provider = get_identity_provider(integration.provider)

        refresh_token = integration.metadata.get('refresh_token')
        if refresh_token is None:
            # TODO: Better exception
            raise Exception('No refresh token')

        data = ident_provider.refresh_oauth_data(refresh_token, **kwargs)

        integration.metadata.update(data)
        integration.save()

        return integration
