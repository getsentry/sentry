from sentry.issues.grouptype import PerformanceRenderBlockingAssetSpanGroupType
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class GroupTagsTest(APITestCase, SnubaTestCase):
    def test_simple(self):
        event1 = self.store_event(
            data={
                "fingerprint": ["group-1"],
                "tags": {"foo": "bar", "biz": "baz"},
                "release": "releaseme",
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "fingerprint": ["group-1"],
                "tags": {"foo": "quux"},
                "release": "releaseme",
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "fingerprint": ["group-2"],
                "tags": {"abc": "xyz"},
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{event1.group.id}/tags/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 4

        data = sorted(response.data, key=lambda r: r["key"])
        assert data[0]["key"] == "biz"
        assert len(data[0]["topValues"]) == 1

        assert data[1]["key"] == "foo"
        assert len(data[1]["topValues"]) == 2

        assert data[2]["key"] == "level"
        assert len(data[2]["topValues"]) == 1

        assert data[3]["key"] == "release"  # Formatted from sentry:release
        assert len(data[3]["topValues"]) == 1

        # Use the key= queryparam to grab results for specific tags
        url = f"/api/0/issues/{event1.group.id}/tags/?key=foo&key=sentry:release"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        data = sorted(response.data, key=lambda r: r["key"])

        assert data[0]["key"] == "foo"
        assert len(data[0]["topValues"]) == 2
        assert {v["value"] for v in data[0]["topValues"]} == {"bar", "quux"}

        assert data[1]["key"] == "release"
        assert len(data[1]["topValues"]) == 1

    def test_simple_performance(self):
        transaction_event_data = {
            "message": "hello",
            "type": "transaction",
            "culprit": "app/components/events/eventEntries in map",
            "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
        }

        event = self.store_event(
            data={
                **transaction_event_data,
                "event_id": "a" * 32,
                "timestamp": iso_format(before_now(minutes=1)),
                "start_timestamp": iso_format(before_now(minutes=1, seconds=5)),
                "tags": {"foo": "bar", "biz": "baz"},
                "release": "releaseme",
                "fingerprint": [f"{PerformanceRenderBlockingAssetSpanGroupType.type_id}-group1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                **transaction_event_data,
                "event_id": "b" * 32,
                "timestamp": iso_format(before_now(minutes=2)),
                "start_timestamp": iso_format(before_now(minutes=2, seconds=5)),
                "tags": {"foo": "quux"},
                "release": "releaseme",
                "fingerprint": [f"{PerformanceRenderBlockingAssetSpanGroupType.type_id}-group1"],
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{event.groups[0].id}/tags/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content

        assert len(response.data) == 5

        data = sorted(response.data, key=lambda r: r["key"])
        assert data[0]["key"] == "biz"
        assert len(data[0]["topValues"]) == 1

        assert data[1]["key"] == "foo"
        assert len(data[1]["topValues"]) == 2

        assert data[2]["key"] == "level"
        assert len(data[2]["topValues"]) == 1

        assert data[3]["key"] == "release"  # Formatted from sentry:release
        assert len(data[3]["topValues"]) == 1

        assert data[4]["key"] == "transaction"
        assert len(data[4]["topValues"]) == 1

        # Use the key= queryparam to grab results for specific tags
        url = f"/api/0/issues/{event.groups[0].id}/tags/?key=foo&key=sentry:release"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content

        data = sorted(response.data, key=lambda r: r["key"])

        assert data[0]["key"] == "foo"
        assert len(data[0]["topValues"]) == 2
        assert {v["value"] for v in data[0]["topValues"]} == {"bar", "quux"}

        assert data[1]["key"] == "release"
        assert len(data[1]["topValues"]) == 1

    def test_invalid_env(self):
        this_group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{this_group.id}/tags/"
        response = self.client.get(url, {"environment": "notreal"}, format="json")
        assert response.status_code == 404

    def test_valid_env(self):
        event = self.store_event(
            data={
                "tags": {"foo": "bar", "biz": "baz"},
                "environment": "prod",
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )
        group = event.group

        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/tags/"
        response = self.client.get(url, {"environment": "prod"}, format="json")
        assert response.status_code == 200
        assert len(response.data) == 4
        assert {tag["key"] for tag in response.data} == {"foo", "biz", "environment", "level"}

    def test_multi_env(self):
        min_ago = before_now(minutes=1)
        env = self.create_environment(project=self.project, name="prod")
        env2 = self.create_environment(project=self.project, name="staging")
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "timestamp": iso_format(min_ago),
                "environment": env.name,
                "tags": {"foo": "bar"},
            },
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "timestamp": iso_format(min_ago),
                "environment": env2.name,
                "tags": {"biz": "baz"},
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        url = f"/api/0/issues/{event2.group.id}/tags/"
        response = self.client.get(
            f"{url}?environment={env.name}&environment={env2.name}", format="json"
        )
        assert response.status_code == 200
        assert {tag["key"] for tag in response.data} >= {"biz", "environment", "foo"}

    def test_readable_tag_values(self):
        event1 = self.store_event(
            data={
                "fingerprint": ["group-1"],
                "tags": {"device": "SM-G9910"},
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "fingerprint": ["group-1"],
                "tags": {"device": "iPhone14,3"},
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "fingerprint": ["group-1"],
                "tags": {"device": "random-model"},
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{event1.group.id}/tags/?readable=true&key=device"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["key"] == "device"

        top_values = sorted(response.data[0]["topValues"], key=lambda r: r["value"])
        assert len(top_values) == 3
        assert top_values[0]["value"] == "SM-G9910"
        assert top_values[0]["readable"] == "Galaxy S21 5G"
        assert top_values[1]["value"] == "iPhone14,3"
        assert top_values[1]["readable"] == "iPhone 13 Pro Max"
        assert top_values[2]["value"] == "random-model"
        assert "readable" not in top_values[2]

    def test_limit(self):
        for _ in range(3):
            self.store_event(
                data={
                    "fingerprint": ["group-1"],
                    "tags": {"os": "iOS"},
                    "timestamp": iso_format(before_now(minutes=1)),
                },
                project_id=self.project.id,
            )
        for _ in range(2):
            self.store_event(
                data={
                    "fingerprint": ["group-1"],
                    "tags": {"os": "android"},
                    "timestamp": iso_format(before_now(minutes=1)),
                },
                project_id=self.project.id,
            )
        event = self.store_event(
            data={
                "fingerprint": ["group-1"],
                "tags": {"os": "windows"},
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{event.group.id}/tags/?limit=2&key=os"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["key"] == "os"
        assert response.data[0]["totalValues"] == 6

        top_values = sorted(response.data[0]["topValues"], key=lambda r: r["value"])
        assert len(top_values) == 2
        assert top_values[0]["value"] == "android"
        assert top_values[1]["value"] == "iOS"

    def test_device_class(self):
        for _ in range(3):
            self.store_event(
                data={
                    "fingerprint": ["group-1"],
                    "tags": {"device.class": "1"},
                    "timestamp": iso_format(before_now(minutes=1)),
                },
                project_id=self.project.id,
            )
        for _ in range(2):
            self.store_event(
                data={
                    "fingerprint": ["group-1"],
                    "tags": {"device.class": "2"},
                    "timestamp": iso_format(before_now(minutes=1)),
                },
                project_id=self.project.id,
            )
        event = self.store_event(
            data={
                "fingerprint": ["group-1"],
                "tags": {"device.class": "3"},
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{event.group.id}/tags/?limit=3&key=device.class"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["key"] == "device.class"
        assert response.data[0]["totalValues"] == 6

        top_values = sorted(response.data[0]["topValues"], key=lambda r: r["value"])
        assert len(top_values) == 3
        assert top_values[0]["value"] == "high"
        assert top_values[1]["value"] == "low"
        assert top_values[2]["value"] == "medium"
