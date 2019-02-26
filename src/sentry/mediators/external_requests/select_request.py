from __future__ import absolute_import

import six
import pytz

from datetime import datetime

from six.moves.urllib.parse import urlparse, urlencode
from sentry.coreapi import APIUnauthorized
from sentry.mediators import Mediator, Param
from sentry.mediators.token_exchange.validator import Validator
from sentry.mediators.token_exchange.util import token_expiration
from sentry.models import ApiApplication, ApiToken, SentryApp
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

    def _build_url(self):
        domain = urlparse(self.sentry_app.webhook_url).netloc
        url = u'https://{}{}'.format(base, self.uri)
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

        try:
            body = safe_urlread(req)
            payload = json.loads(body)
        except Exception as e:
            raise

    def _build_headers(self):
        request_uuid = uuid4().hex

        return {
            'Content-Type': 'application/json',
            'Request-ID': request_uuid,
            'Sentry-App-Signature': self.install.sentry_app.build_signature(self.body)
        }

    @memoize
    def sentry_app(self):
        return self.install.sentry_app
