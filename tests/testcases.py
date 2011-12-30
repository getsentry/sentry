import time
import base64

from sentry.conf import settings
from sentry.utils import json
from sentry.utils.auth import get_signature, get_auth_header
from sentry.utils.compat import pickle
from sentry.utils.compat.db import connections

from django.core.management import call_command
from django.core.urlresolvers import reverse
from django.db import DEFAULT_DB_ALIAS
from django.test import TestCase, TransactionTestCase
from django.test.client import Client

class BaseTestCase(object):
    urls = 'tests.urls'

    def _postWithKey(self, data, key=None):
        resp = self.client.post(reverse('sentry-store'), {
            'data': base64.b64encode(pickle.dumps(data)),
            'key': settings.KEY,
        })
        return resp

    def _makeMessage(self, data, key=None):
        ts = time.time()
        message = base64.b64encode(json.dumps(data))
        sig = get_signature(message, ts, key)
        return ts, message, sig

    def _postWithSignature(self, data, key=None):
        ts, message, sig = self._makeMessage(data, key)

        resp = self.client.post(reverse('sentry-store'), message,
            content_type='application/octet-stream',
            HTTP_AUTHORIZATION=get_auth_header(sig, ts, '_postWithSignature', key),
        )
        return resp

    def _postWithNewSignature(self, data, key=None):
        ts, message, sig = self._makeMessage(data, key)

        resp = self.client.post(reverse('sentry-store'), message,
            content_type='application/octet-stream',
            HTTP_X_SENTRY_AUTH=get_auth_header(sig, ts, '_postWithSignature', key),
        )
        return resp

class TestCase(BaseTestCase, TestCase):
    pass

class TransactionTestCase(BaseTestCase, TransactionTestCase):
    """
    Subclass of ``django.test.TransactionTestCase`` that quickly tears down
    fixtures and doesn't `flush` on setup.  This enables tests to be run in
    any order.
    """
    urls = 'tests.urls'

    def __call__(self, result=None):
        """
        Wrapper around default __call__ method to perform common Django test
        set up. This means that user-defined Test Cases aren't required to
        include a call to super().setUp().
        """
        self.client = getattr(self, 'client_class', Client)()
        try:
            self._pre_setup()
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception:
            import sys
            result.addError(self, sys.exc_info())
            return
        try:
            super(TransactionTestCase, self).__call__(result)
        finally:
            try:
                self._post_teardown()
            except (KeyboardInterrupt, SystemExit):
                raise
            except Exception:
                import sys
                result.addError(self, sys.exc_info())

    def _get_databases(self):
        if getattr(self, 'multi_db', False):
            return connections
        return [DEFAULT_DB_ALIAS]

    def _fixture_setup(self):
        for db in self._get_databases():
            if hasattr(self, 'fixtures') and self.fixtures:
                # We have to use this slightly awkward syntax due to the fact
                # that we're using *args and **kwargs together.
                call_command('loaddata', *self.fixtures, **{'verbosity': 0, 'database': db})

    def _fixture_teardown(self):
        for db in self._get_databases():
            call_command('flush', verbosity=0, interactive=False, database=db)
