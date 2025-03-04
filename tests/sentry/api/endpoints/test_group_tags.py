from sentry.testutils.cases import APITestCase, PerformanceIssueTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class GroupTagsTest(APITestCase, SnubaTestCase, PerformanceIssueTestCase):
    def test_simple(self):
        event1 = self.store_event(
            data={
                "fingerprint": ["group-1"],
                "tags": {"foo": "bar", "biz": "baz"},
                "release": "releaseme",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "fingerprint": ["group-1"],
                "tags": {"foo": "quux"},
                "release": "releaseme",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "fingerprint": ["group-2"],
                "tags": {"abc": "xyz"},
                "timestamp": before_now(minutes=1).isoformat(),
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
        event = self.create_performance_issue(
            tags=[["foo", "bar"], ["biz", "baz"], ["sentry:release", "releaseme"]],
            fingerprint="group5",
            contexts={"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
        )
        self.create_performance_issue(
            tags=[["foo", "quux"], ["sentry:release", "releaseme"]],
            fingerprint="group5",
            contexts={"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{event.group.id}/tags/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content

        assert len(response.data) == 14

        data = sorted(response.data, key=lambda r: r["key"])
        assert data[0]["key"] == "biz"
        assert len(data[0]["topValues"]) == 1

        assert data[8]["key"] == "foo"
        assert len(data[8]["topValues"]) == 2

        assert data[9]["key"] == "level"
        assert len(data[9]["topValues"]) == 1

        assert data[10]["key"] == "release"  # Formatted from sentry:release
        assert len(data[10]["topValues"]) == 1

        assert data[11]["key"] == "transaction"
        assert len(data[11]["topValues"]) == 1

        # Use the key= queryparam to grab results for specific tags
        url = f"/api/0/issues/{event.group.id}/tags/?key=foo&key=sentry:release"
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
                "timestamp": before_now(minutes=1).isoformat(),
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
                "timestamp": min_ago.isoformat(),
                "environment": env.name,
                "tags": {"foo": "bar"},
            },
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "timestamp": min_ago.isoformat(),
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
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "fingerprint": ["group-1"],
                "tags": {"device": "iPhone14,3"},
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "fingerprint": ["group-1"],
                "tags": {"device": "random-model"},
                "timestamp": before_now(minutes=1).isoformat(),
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
                    "timestamp": before_now(minutes=1).isoformat(),
                },
                project_id=self.project.id,
            )
        for _ in range(2):
            self.store_event(
                data={
                    "fingerprint": ["group-1"],
                    "tags": {"os": "android"},
                    "timestamp": before_now(minutes=1).isoformat(),
                },
                project_id=self.project.id,
            )
        event = self.store_event(
            data={
                "fingerprint": ["group-1"],
                "tags": {"os": "windows"},
                "timestamp": before_now(minutes=1).isoformat(),
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
                    "timestamp": before_now(minutes=1).isoformat(),
                },
                project_id=self.project.id,
            )
        for _ in range(2):
            self.store_event(
                data={
                    "fingerprint": ["group-1"],
                    "tags": {"device.class": "2"},
                    "timestamp": before_now(minutes=1).isoformat(),
                },
                project_id=self.project.id,
            )
        event = self.store_event(
            data={
                "fingerprint": ["group-1"],
                "tags": {"device.class": "3"},
                "timestamp": before_now(minutes=1).isoformat(),
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

    def test_flags(self):
        event1 = self.store_event(
            data={
                "fingerprint": ["group-1"],
                "tags": {"foo": "bar"},
                "release": "releaseme",
                "timestamp": before_now(minutes=1).isoformat(),
                "contexts": {
                    "flags": {
                        "values": [
                            {"flag": "hello", "result": True},
                            {"flag": "goodbye", "result": False},
                        ]
                    }
                },
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "fingerprint": ["group-1"],
                "timestamp": before_now(minutes=2).isoformat(),
                "contexts": {
                    "flags": {
                        "values": [
                            {"flag": "hello", "result": False},
                            {"flag": "world", "result": True},
                        ]
                    }
                },
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "fingerprint": ["group-1"],
                "timestamp": before_now(minutes=3).isoformat(),
                "contexts": {"flags": {"values": [{"flag": "hello", "result": False}]}},
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "fingerprint": ["group-2"],
                "timestamp": before_now(minutes=1).isoformat(),
                "contexts": {
                    "flags": {
                        "values": [
                            {"flag": "hello", "result": False},
                            {"flag": "group2", "result": True},
                        ]
                    }
                },
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{event1.group.id}/tags/?useFlagsBackend=1"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 3

        data = sorted(response.data, key=lambda r: r["key"])

        assert data[0]["key"] == "goodbye"
        assert len(data[0]["topValues"]) == 1
        assert data[0]["topValues"][0]["value"] == "false"
        assert data[0]["topValues"][0]["count"] == 1

        assert data[1]["key"] == "hello"
        assert len(data[1]["topValues"]) == 2
        assert data[1]["topValues"][0]["value"] == "false"
        assert data[1]["topValues"][0]["count"] == 2
        assert data[1]["topValues"][1]["value"] == "true"
        assert data[1]["topValues"][1]["count"] == 1

        assert data[2]["key"] == "world"
        assert len(data[2]["topValues"]) == 1
        assert data[2]["topValues"][0]["value"] == "true"
        assert data[2]["topValues"][0]["count"] == 1

        # Use the key= queryparam to grab results for specific tags
        url = f"/api/0/issues/{event1.group.id}/tags/?key=hello&key=world&useFlagsBackend=1"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        data = sorted(response.data, key=lambda r: r["key"])

        assert data[0]["key"] == "hello"
        assert len(data[0]["topValues"]) == 2
        assert data[0]["topValues"][0]["value"] == "false"
        assert data[0]["topValues"][0]["count"] == 2
        assert data[0]["topValues"][1]["value"] == "true"
        assert data[0]["topValues"][1]["count"] == 1

        assert data[1]["key"] == "world"
        assert len(data[1]["topValues"]) == 1
        assert data[1]["topValues"][0]["value"] == "true"
        assert data[1]["topValues"][0]["count"] == 1

    def test_flags_limit(self):
        for i in range(10):
            event = self.store_event(
                data={
                    "fingerprint": ["group-1"],
                    "timestamp": before_now(minutes=1).isoformat(),
                    "contexts": {
                        "flags": {
                            "values": [
                                {"flag": "hello", "result": i},
                            ]
                        }
                    },
                },
                project_id=self.project.id,
            )

        self.login_as(user=self.user)
        url = f"/api/0/issues/{event.group.id}/tags/?useFlagsBackend=1&limit=3"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["key"] == "hello"
        assert len(response.data[0]["topValues"]) == 3

    def test_flags_reserved_tag_key(self):
        # Flag backend should not handle reserved tag keys differently.
        # The `sentry:` prefix used for reserved tags should not be stripped from the input or stored.
        event1 = self.store_event(
            data={
                "fingerprint": ["group-1"],
                "release": "releaseme",
                "timestamp": before_now(minutes=1).isoformat(),
                "contexts": {"flags": {"values": [{"flag": "release", "result": True}]}},
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{event1.group.id}/tags/?useFlagsBackend=1&key=sentry:release"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        url = f"/api/0/issues/{event1.group.id}/tags/?useFlagsBackend=1&key=release"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["key"] == "release"
