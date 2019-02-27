from __future__ import absolute_import

import six
from sentry.utils import json
from uuid import uuid4

from six.moves.urllib.parse import urlparse, urlencode
from sentry.http import safe_urlopen, safe_urlread
from sentry.coreapi import APIUnauthorized
from sentry.mediators import Mediator, Param
from sentry.mediators.external_requests.util import validate
from sentry.utils.cache import memoize


class SelectRequester(Mediator):
    """
    Makes a request to another service and returns
    the response.
    """

    install = Param('sentry.models.SentryAppInstallation')
    project = Param('sentry.models.Project')
    uri = Param(six.string_types)

    def call(self):
        self._make_request()
        return self.response

    def _build_url(self):
        domain = urlparse(self.sentry_app.webhook_url).netloc
        url = u'https://{}{}'.format(domain, self.uri)
        url += '?' + urlencode({
            'installationId': self.install.uuid,
            'project': self.project.slug,
        })
        return url

    def _make_request(self):
        req = safe_urlopen(
            url=self._build_url(),
            headers=self._build_headers(),
        )

        body = safe_urlread(req)
        response = json.loads(body)

        is_valid = self._validate_response(response)
        if not is_valid:
            raise APIUnauthorized('In valid response format')

        self.response = response

    def _validate_response(self, resp):
        return validate(instance=resp, schema_type='select')

    def _build_headers(self):
        request_uuid = uuid4().hex

        return {
            'Content-Type': 'application/json',
            'Request-ID': request_uuid,
            'Sentry-App-Signature': self.sentry_app.build_signature('')
        }

    @memoize
    def sentry_app(self):
        return self.install.sentry_app
