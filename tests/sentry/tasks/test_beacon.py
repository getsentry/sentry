import platform
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import responses
from django.utils import timezone

import sentry
from sentry import options
from sentry.constants import DataCategory
from sentry.models.broadcast import Broadcast
from sentry.tasks.beacon import BEACON_URL, send_beacon, send_beacon_metric
from sentry.testutils.cases import OutcomesSnubaTest
from sentry.testutils.silo import no_silo_test
from sentry.utils import json
from sentry.utils.outcomes import Outcome


@no_silo_test
@patch("psutil.cpu_count", return_value=8)
@patch("psutil.cpu_percent", return_value=50)
@patch(
    "psutil.virtual_memory",
    return_value=SimpleNamespace(
        total=34359738368,
        percent=50,
    ),
)
class SendBeaconTest(OutcomesSnubaTest):
    def setUp(self):
        super().setUp()
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": timezone.now() - timedelta(hours=1),
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 1,
            },
            5,  # Num of outcomes to be stored
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": timezone.now() - timedelta(hours=1),
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.REPLAY,
                "quantity": 1,
            },
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": timezone.now() - timedelta(hours=1),
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.TRANSACTION,
                "quantity": 2,
            },
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": timezone.now() - timedelta(hours=1),
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.PROFILE,
                "quantity": 3,
            },
        )
        self.org2 = self.create_organization()
        self.project2 = self.create_project(
            name="bar", teams=[self.create_team(organization=self.org2, members=[self.user])]
        )
        self.store_outcomes(
            {
                "org_id": self.org2.id,
                "timestamp": timezone.now() - timedelta(hours=1),
                "project_id": self.project2.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 1,
            },
            3,  # Num of outcomes to be stored
        )

    @patch("sentry.tasks.beacon.get_all_package_versions")
    @patch("sentry.tasks.beacon.safe_urlopen")
    @patch("sentry.tasks.beacon.safe_urlread")
    @responses.activate
    def test_simple(
        self,
        safe_urlread,
        safe_urlopen,
        mock_get_all_package_versions,
        mock_cpu_count,
        mock_cpu_percent,
        mock_virtual_memory,
    ):
        self.organization
        self.project
        self.team
        mock_get_all_package_versions.return_value = {"foo": "1.0"}
        safe_urlread.return_value = json.dumps({"notices": [], "version": {"stable": "1.0.0"}})

        assert options.set("system.admin-email", "foo@example.com")
        assert options.set("beacon.anonymous", False)
        assert options.set("beacon.record_cpu_ram_usage", True)
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
                    "organizations": 2,
                    "users": 1,
                    "projects": 2,
                    "teams": 2,
                    "events.24h": 8,  # We expect the number of events to be the sum of events from two orgs. First org has 5 events while the second org has 3 events.
                    "errors.24h": 8,
                    "transactions.24h": 2,
                    "replays.24h": 1,
                    "profiles.24h": 3,
                    "monitors.24h": 0,
                    "cpu_cores_available": 8,
                    "cpu_percentage_utilized": 50,
                    "ram_available_gb": 32,
                    "ram_percentage_utilized": 50,
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
    def test_no_cpu_ram_usage(
        self,
        safe_urlread,
        safe_urlopen,
        mock_get_all_package_versions,
        mock_cpu_count,
        mock_cpu_percent,
        mock_virtual_memory,
    ):
        self.organization
        self.project
        self.team
        mock_get_all_package_versions.return_value = {"foo": "1.0"}
        safe_urlread.return_value = json.dumps({"notices": [], "version": {"stable": "1.0.0"}})

        assert options.set("system.admin-email", "foo@example.com")
        assert options.set("beacon.anonymous", False)
        assert options.set("beacon.record_cpu_ram_usage", False)
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
                    "organizations": 2,
                    "users": 1,
                    "projects": 2,
                    "teams": 2,
                    "events.24h": 8,  # We expect the number of events to be the sum of events from two orgs. First org has 5 events while the second org has 3 events.
                    "errors.24h": 8,
                    "transactions.24h": 2,
                    "replays.24h": 1,
                    "profiles.24h": 3,
                    "monitors.24h": 0,
                    "cpu_cores_available": None,
                    "cpu_percentage_utilized": None,
                    "ram_available_gb": None,
                    "ram_percentage_utilized": None,
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
    def test_anonymous(
        self,
        safe_urlread,
        safe_urlopen,
        mock_get_all_package_versions,
        mock_cpu_count,
        mock_cpu_percent,
        mock_virtual_memory,
    ):
        self.organization
        self.project
        self.team
        mock_get_all_package_versions.return_value = {"foo": "1.0"}
        safe_urlread.return_value = json.dumps({"notices": [], "version": {"stable": "1.0.0"}})

        assert options.set("system.admin-email", "foo@example.com")
        assert options.set("beacon.anonymous", True)
        assert options.set("beacon.record_cpu_ram_usage", True)
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
                    "organizations": 2,
                    "users": 1,
                    "projects": 2,
                    "teams": 2,
                    "events.24h": 8,  # We expect the number of events to be the sum of events from two orgs. First org has 5 events while the second org has 3 events.
                    "errors.24h": 8,
                    "transactions.24h": 2,
                    "replays.24h": 1,
                    "profiles.24h": 3,
                    "monitors.24h": 0,
                    "cpu_cores_available": 8,
                    "cpu_percentage_utilized": 50,
                    "ram_available_gb": 32,
                    "ram_percentage_utilized": 50,
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
    def test_with_broadcasts(
        self,
        safe_urlread,
        safe_urlopen,
        mock_get_all_package_versions,
        mock_cpu_count,
        mock_cpu_percent,
        mock_virtual_memory,
    ):
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
    def test_disabled(
        self,
        safe_urlread,
        safe_urlopen,
        mock_get_all_package_versions,
        mock_cpu_count,
        mock_cpu_percent,
        mock_virtual_memory,
    ):
        mock_get_all_package_versions.return_value = {"foo": "1.0"}

        with self.settings(SENTRY_BEACON=False):
            send_beacon()

        assert not safe_urlopen.mock_calls

    @patch("sentry.tasks.beacon.get_all_package_versions")
    @patch("sentry.tasks.beacon.safe_urlopen")
    @patch("sentry.tasks.beacon.safe_urlread")
    @responses.activate
    def test_debug(
        self,
        safe_urlread,
        safe_urlopen,
        mock_get_all_package_versions,
        mock_cpu_count,
        mock_cpu_percent,
        mock_virtual_memory,
    ):
        mock_get_all_package_versions.return_value = {"foo": "1.0"}

        with self.settings(DEBUG=True):
            send_beacon()

        assert not safe_urlopen.mock_calls

    @patch("sentry.tasks.beacon.safe_urlopen")
    @responses.activate
    def test_metrics(
        self,
        safe_urlopen,
        mock_cpu_count,
        mock_cpu_percent,
        mock_virtual_memory,
    ):
        metrics = [
            {
                "description": "SentryApp",
                "component": "Foo",
            },
            {
                "description": "SentryApp",
                "component": "Bar",
            },
        ]

        send_beacon_metric(metrics=metrics)

        install_id = options.get("sentry:install-id")
        assert install_id and len(install_id) == 40

        assert safe_urlopen.call_count == 1
        safe_urlopen.assert_called_once_with(
            BEACON_URL,
            json={
                "type": "metric",
                "install_id": install_id,
                "version": sentry.get_version(),
                "data": {"metrics": metrics},
            },
            timeout=5,
        )
