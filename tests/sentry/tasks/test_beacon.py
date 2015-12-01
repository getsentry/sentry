from __future__ import absolute_import, print_function

import json
import sentry

from mock import patch
from uuid import uuid4

from sentry import options
from sentry.models import Broadcast
from sentry.testutils import TestCase
from sentry.tasks.beacon import BEACON_URL, send_beacon


class SendBeaconTest(TestCase):
    @patch('sentry.tasks.beacon.safe_urlopen')
    @patch('sentry.tasks.beacon.safe_urlread')
    def test_simple(self, safe_urlread, safe_urlopen):
        safe_urlread.return_value = json.dumps({
            'notices': [],
            'version': {'stable': '1.0.0'},
        })

        assert options.set('system.admin-email', 'foo@example.com')
        send_beacon()

        install_id = options.get('sentry:install-id')
        assert install_id and len(install_id) == 40

        safe_urlopen.assert_called_once_with(BEACON_URL, json={
            'install_id': install_id,
            'version': sentry.get_version(),
            'data': {
                'organizations': 1,
                'users': 0,
                'projects': 1,
                'teams': 1,
                'events.24h': 0,
            },
            'admin_email': 'foo@example.com',
        }, timeout=5)
        safe_urlread.assert_called_once_with(safe_urlopen.return_value)

        assert options.get('sentry:latest_version') == '1.0.0'

    @patch('sentry.tasks.beacon.safe_urlopen')
    @patch('sentry.tasks.beacon.safe_urlread')
    def test_with_broadcasts(self, safe_urlread, safe_urlopen):
        broadcast_id = uuid4().hex

        safe_urlread.return_value = json.dumps({
            'notices': [{
                'id': broadcast_id,
                'title': 'Hello!',
                'message': 'Hello world',
                'active': True,
            }],
            'version': {'stable': '1.0.0'},
        })

        with self.settings():
            send_beacon()

        broadcast = Broadcast.objects.get(upstream_id=broadcast_id)

        assert broadcast.title == 'Hello!'
        assert broadcast.message == 'Hello world'
        assert broadcast.is_active

        safe_urlread.return_value = json.dumps({
            'notices': [],
            'version': {'stable': '1.0.0'},
        })

        with self.settings():
            send_beacon()

        # test explicit disable
        broadcast = Broadcast.objects.get(upstream_id=broadcast_id)

        assert not broadcast.is_active
