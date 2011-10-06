import base64
import time

from sentry.conf import settings
from sentry.utils import json, transform
from sentry.utils.auth import get_signature, get_auth_header
from sentry.utils.compat import pickle
from sentry.utils.compat.db import connections

from django.core.management import call_command
from django.core.urlresolvers import reverse
from django.db import DEFAULT_DB_ALIAS
from django.test import TestCase, TransactionTestCase
from django.test.client import Client

class TestCase(TestCase):
    ## Helper methods for posting

    urls = 'tests.urls'

    def _postWithKey(self, data):
        resp = self.client.post(reverse('sentry-store'), {
            'data': base64.b64encode(pickle.dumps(transform(data))),
            'key': settings.KEY,
        })
        return resp

    def _postWithSignature(self, data):
        ts = time.time()
        message = base64.b64encode(json.dumps(transform(data)))
        sig = get_signature(message, ts)

        resp = self.client.post(reverse('sentry-store'), message,
            content_type='application/octet-stream',
            HTTP_AUTHORIZATION=get_auth_header(sig, ts, '_postWithSignature'),
        )
        return resp

class TransactionTestCase(TransactionTestCase):
    """
    Subclass of ``django.test.TransactionTestCase`` that quickly tears down
    fixtures and doesn't `flush` on setup.  This enables tests to be run in
    any order.
    """
    tags = ['transaction']

    multi_db = True
    databases = None

    def __call__(self, result=None):
        """
        Wrapper around default __call__ method to perform common Django test
        set up. This means that user-defined Test Cases aren't required to
        include a call to super().setUp().
        """
        self.client = Client()
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
                return

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