from __future__ import absolute_import, print_function

import json
import sentry

from mock import patch

from sentry import options
from sentry.testutils import TestCase
from sentry.tasks.beacon import BEACON_URL, send_beacon


class SendBeaconTest(TestCase):
    @patch('sentry.tasks.beacon.safe_urlopen')
    @patch('sentry.tasks.beacon.safe_urlread')
    def test_simple(self, safe_urlread, safe_urlopen):
        self.create_project(platform='java')

        safe_urlread.return_value = json.dumps({
            'notices': [],
            'version': {'stable': '1.0.0'},
        })

        with self.settings(SENTRY_ADMIN_EMAIL='foo@example.com'):
            send_beacon()

        install_id = options.get('sentry:install-id')
        assert install_id and len(install_id) == 40

        safe_urlopen.assert_called_once_with(BEACON_URL, json={
            'install_id': install_id,
            'version': sentry.get_version(),
            'data': {
                'platforms': ['java'],
                'organizations': 2,
                'users': 2,
                'projects': 2,
                'teams': 2,
                'events.24h': 0,
            },
            'admin_email': 'foo@example.com',
        }, timeout=5)
        safe_urlread.assert_called_once_with(safe_urlopen.return_value)

        assert options.get('sentry:latest_version') == '1.0.0'
