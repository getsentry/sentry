from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser

from sentry.models import ApiKey
from sentry.testutils import APITestCase
from sentry.utils.audit import create_audit_entry


class FakeHttpRequest(object):
    def __init__(self, user):
        self.user = user
        self.META = {'REMOTE_ADDR': '127.0.0.1'}


class CreateAuditEntryTest(APITestCase):

    def test_audit_entry_api(self):
        org = self.create_organization()
        apikey = ApiKey.objects.create(
            organization=org,
            allowed_origins='*',
        )

        req = FakeHttpRequest(AnonymousUser())
        req.auth = apikey

        entry = create_audit_entry(req)
        assert entry.actor_key == apikey
        assert entry.actor is None
        assert entry.ip_address == req.META['REMOTE_ADDR']
        # assert no deletedlog was created?

    def test_audit_entry_frontend(self):
        req = FakeHttpRequest(self.create_user())
        entry = create_audit_entry(req)

        assert entry.actor == req.user
        assert entry.actor_key is None
        assert entry.ip_address == req.META['REMOTE_ADDR']
