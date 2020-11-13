from __future__ import absolute_import, print_function

import platform
import responses
import sentry

from sentry.utils.compat.mock import patch
from uuid import uuid4

from sentry import options
from sentry.models import Broadcast
from sentry.testutils import TestCase
from sentry.tasks.beacon import BEACON_URL, send_beacon
from sentry.utils import json


class SendBeaconTest(TestCase):
    @patch("sentry.tasks.beacon.get_all_package_versions")
    @patch("sentry.tasks.beacon.safe_urlopen")
    @patch("sentry.tasks.beacon.safe_urlread")
    @responses.activate
    def test_simple(self, safe_urlread, safe_urlopen, mock_get_all_package_versions):
        mock_get_all_package_versions.return_value = {"foo": "1.0"}
        safe_urlread.return_value = json.dumps({"notices": [], "version": {"stable": "1.0.0"}})

        assert options.set("system.admin-email", "foo@example.com")
        assert options.set("beacon.anonymous", False)
        send_beacon()

        install_id = options.get("sentry:install-id")
        assert install_id and len(install_id) == 40

        safe_urlopen.assert_called_once_with(
            BEACON_URL,
            json={
                "install_id": install_id,
                "version": sentry.get_version(),
                "docker": sentry.is_docker(),
                "python_version": platform.python_version(),
                "data": {
                    "organizations": 1,
                    "users": 0,
                    "projects": 1,
                    "teams": 1,
                    "events.24h": 0,
                },
                "anonymous": False,
                "admin_email": "foo@example.com",
                "packages": mock_get_all_package_versions.return_value,
            },
            timeout=5,
        )
        safe_urlread.assert_called_once_with(safe_urlopen.return_value)

        assert options.get("sentry:latest_version") == "1.0.0"

    @patch("sentry.tasks.beacon.get_all_package_versions")
    @patch("sentry.tasks.beacon.safe_urlopen")
    @patch("sentry.tasks.beacon.safe_urlread")
    @responses.activate
    def test_anonymous(self, safe_urlread, safe_urlopen, mock_get_all_package_versions):
        mock_get_all_package_versions.return_value = {"foo": "1.0"}
        safe_urlread.return_value = json.dumps({"notices": [], "version": {"stable": "1.0.0"}})

        assert options.set("system.admin-email", "foo@example.com")
        assert options.set("beacon.anonymous", True)
        send_beacon()

        install_id = options.get("sentry:install-id")
        assert install_id and len(install_id) == 40

        safe_urlopen.assert_called_once_with(
            BEACON_URL,
            json={
                "install_id": install_id,
                "version": sentry.get_version(),
                "docker": sentry.is_docker(),
                "python_version": platform.python_version(),
                "data": {
                    "organizations": 1,
                    "users": 0,
                    "projects": 1,
                    "teams": 1,
                    "events.24h": 0,
                },
                "anonymous": True,
                "packages": mock_get_all_package_versions.return_value,
            },
            timeout=5,
        )
        safe_urlread.assert_called_once_with(safe_urlopen.return_value)

        assert options.get("sentry:latest_version") == "1.0.0"

    @patch("sentry.tasks.beacon.get_all_package_versions")
    @patch("sentry.tasks.beacon.safe_urlopen")
    @patch("sentry.tasks.beacon.safe_urlread")
    @responses.activate
    def test_with_broadcasts(self, safe_urlread, safe_urlopen, mock_get_all_package_versions):
        broadcast_id = uuid4().hex
        mock_get_all_package_versions.return_value = {}
        safe_urlread.return_value = json.dumps(
            {
                "notices": [
                    {
                        "id": broadcast_id,
                        "title": "Hello!",
                        "message": "Hello world",
                        "active": True,
                    }
                ],
                "version": {"stable": "1.0.0"},
            }
        )

        with self.settings():
            send_beacon()

        assert Broadcast.objects.count() == 1

        broadcast = Broadcast.objects.get(upstream_id=broadcast_id)

        assert broadcast.title == "Hello!"
        assert broadcast.message == "Hello world"
        assert broadcast.is_active

        # ensure we arent duplicating the broadcast
        with self.settings():
            send_beacon()

        assert Broadcast.objects.count() == 1

        broadcast = Broadcast.objects.get(upstream_id=broadcast_id)

        assert broadcast.title == "Hello!"
        assert broadcast.message == "Hello world"
        assert broadcast.is_active

        # now remove it and it should become inactive
        safe_urlread.return_value = json.dumps({"notices": [], "version": {"stable": "1.0.0"}})

        with self.settings():
            send_beacon()

        assert Broadcast.objects.count() == 1

        broadcast = Broadcast.objects.get(upstream_id=broadcast_id)

        assert not broadcast.is_active

    @patch("sentry.tasks.beacon.get_all_package_versions")
    @patch("sentry.tasks.beacon.safe_urlopen")
    @patch("sentry.tasks.beacon.safe_urlread")
    @responses.activate
    def test_disabled(self, safe_urlread, safe_urlopen, mock_get_all_package_versions):
        mock_get_all_package_versions.return_value = {"foo": "1.0"}

        with self.settings(SENTRY_BEACON=False):
            send_beacon()

        assert not safe_urlopen.mock_calls

    @patch("sentry.tasks.beacon.get_all_package_versions")
    @patch("sentry.tasks.beacon.safe_urlopen")
    @patch("sentry.tasks.beacon.safe_urlread")
    @responses.activate
    def test_debug(self, safe_urlread, safe_urlopen, mock_get_all_package_versions):
        mock_get_all_package_versions.return_value = {"foo": "1.0"}

        with self.settings(DEBUG=True):
            send_beacon()

        assert not safe_urlopen.mock_calls
