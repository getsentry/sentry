from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser

from sentry.models import ApiKey
from sentry.testutils import APITestCase
from sentry.utils.audit import create_audit_entry


class FakeHttpRequest(object):
    def __init__(self, user, META):
        self.user = user
        self.META = META


class CreateAuditEntryTest(APITestCase):

    def test_audit_entry_api(self):
        org = self.create_organization()
        apikey = ApiKey.objects.create(
            organization=org,
            allowed_origins='*',
        )
        meta = {
            'REMOTE_ADDR': '127.0.0.1',
            'HTTP_AUTHORIZATION': apikey
        }
        req = FakeHttpRequest(AnonymousUser(), meta)
        req.auth = apikey

        entry = create_audit_entry(req)
        assert entry.actor_key == req.META['HTTP_AUTHORIZATION']
        assert entry.actor is None
        assert entry.ip_address == req.META['REMOTE_ADDR']

    def test_audit_entry_frontend(self):
        req = FakeHttpRequest(self.create_user(), {'REMOTE_ADDR': '127.0.0.1'})

        entry = create_audit_entry(req)
        assert entry.actor == req.user
        assert entry.ip_address == req.META['REMOTE_ADDR']
