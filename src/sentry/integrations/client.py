from __future__ import absolute_import

import logging
import json
import requests

from collections import OrderedDict

from BeautifulSoup import BeautifulStoneSoup
from requests.exceptions import ConnectionError, HTTPError

from django.utils.functional import cached_property

from sentry.http import build_session

from .exceptions import ApiHostError, ApiError, ApiUnauthorized, UnsupportedResponseType


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
                raise ValueError('Not a valid response type: {}'.format(response.text[:128]))
            elif response.status_code < 200 or response.status_code >= 300:
                raise ValueError('Received unexpected plaintext response for code {}'.format(
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
                raise ValueError('Invalid URL: {}'.format(path))
            return '{}{}'.format(self.base_url, path)
        return path

    def _request(self, method, path, headers=None, data=None, params=None,
                 auth=None, json=True, allow_text=None, allow_redirects=None):

        if allow_text is None:
            allow_text = self.allow_text

        if allow_redirects is None:
            allow_redirects = self.allow_redirects

        if allow_redirects is None:  # is still None
            allow_redirects = method.upper() == 'GET'

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
                verify=False,
                allow_redirects=allow_redirects,
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


class AuthApiClient(ApiClient):
    auth = None

    def __init__(self, auth=None, *args, **kwargs):
        self.auth = auth
        super(AuthApiClient, self).__init__(*args, **kwargs)

    def has_auth(self):
        return self.auth and 'access_token' in self.auth.tokens

    def exception_means_unauthorized(self, exc):
        return isinstance(exc, ApiUnauthorized)

    def ensure_auth(self, **kwargs):
        headers = kwargs['headers']
        if 'Authorization' not in headers and self.has_auth() and 'auth' not in kwargs:
            kwargs = self.bind_auth(**kwargs)
        return kwargs

    def bind_auth(self, **kwargs):
        token = self.auth.tokens['access_token']
        kwargs['headers']['Authorization'] = 'Bearer {}'.format(token)
        return kwargs

    def _request(self, method, path, **kwargs):
        headers = kwargs.setdefault('headers', {})
        headers.setdefault('Accept', 'application/json, application/xml')

        # TODO(dcramer): we could proactively refresh the token if we knew
        # about expires
        kwargs = self.ensure_auth(**kwargs)

        try:
            return ApiClient._request(self, method, path, **kwargs)
        except Exception as exc:
            if not self.exception_means_unauthorized(exc):
                raise
            if not self.auth:
                raise

        # refresh token
        self.logger.info('token.refresh', extra={
            'auth_id': self.auth.id,
            'provider': self.auth.provider,
        })
        self.auth.refresh_token()
        kwargs = self.bind_auth(**kwargs)
        return ApiClient._request(self, method, path, **kwargs)
