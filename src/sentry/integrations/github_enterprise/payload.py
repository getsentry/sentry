from __future__ import absolute_import

import hashlib
import hmac
import logging
import six

from django.http import HttpResponse
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from simplejson import JSONDecodeError
from sentry import options

from sentry.utils import json
from sentry.api.base import Endpoint

logger = logging.getLogger('sentry.integrations.github-enterprise')


class GitHubEnterpriseAppsEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        return super(GitHubEnterpriseAppsEndpoint, self).dispatch(request, *args, **kwargs)

    def get_secret(self):
        # todo(maxbittker)
        return options.get('github-enterprise-app.webhook-secret')

    def is_valid_signature(self, method, body, secret, signature):
        if method != 'sha1':
            raise NotImplementedError('signature method %s is not supported' % (method, ))

        mod = hashlib.sha1
        expected = hmac.new(
            key=secret.encode('utf-8'),
            msg=body,
            digestmod=mod,
        ).hexdigest()
        return constant_time_compare(expected, signature)

    def post(self, request, *kwargs):

        secret = self.get_secret()
        if secret is None:
            logger.error('github-enterpise.webhook.missing-secret',)
            return HttpResponse(status=401)

        body = six.binary_type(request.body)
        if not body:
            logger.error('github-enterpise.webhook.missing-body',)
            return HttpResponse(status=400)

        try:
            method, signature = request.META['HTTP_X_HUB_SIGNATURE'].split('=', 1)
        except (KeyError, IndexError):
            logger.error('github-enterpise.webhook.missing-signature',)
            return HttpResponse(status=400)

        if not self.is_valid_signature(method, body, self.get_secret(), signature):
            logger.error('github-enterpise.webhook.invalid-signature',)
            return HttpResponse(status=401)

        try:
            json.loads(body.decode('utf-8'))
        except JSONDecodeError:
            logger.error(
                'github-enterpise.webhook.invalid-json',
                exc_info=True,
            )
            return HttpResponse(status=400)

        return HttpResponse(status=200)
