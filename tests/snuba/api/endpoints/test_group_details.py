from unittest import mock

from rest_framework.exceptions import ErrorDetail

from sentry.models import Environment, GroupInboxReason, Release
from sentry.models.groupinbox import add_group_to_inbox, remove_group_from_inbox
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class GroupDetailsTest(APITestCase, SnubaTestCase):
    def test_multiple_environments(self):
        group = self.create_group()
        self.login_as(user=self.user)

        environment = Environment.get_or_create(group.project, "production")
        environment2 = Environment.get_or_create(group.project, "staging")

        url = f"/api/0/issues/{group.id}/"

        from sentry.api.endpoints.group_details import tsdb

        with mock.patch(
            "sentry.api.endpoints.group_details.tsdb.get_range", side_effect=tsdb.get_range
        ) as get_range:
            response = self.client.get(
                f"{url}?environment=production&environment=staging", format="json"
            )
            assert response.status_code == 200
            assert get_range.call_count == 2
            for args, kwargs in get_range.call_args_list:
                assert kwargs["environment_ids"] == [environment.id, environment2.id]

        response = self.client.get(f"{url}?environment=invalid", format="json")
        assert response.status_code == 404

    def test_with_first_last_release(self):
        self.login_as(user=self.user)
        first_release = {
            "firstEvent": before_now(minutes=3),
            "lastEvent": before_now(minutes=2, seconds=30),
        }
        last_release = {
            "firstEvent": before_now(minutes=1, seconds=30),
            "lastEvent": before_now(minutes=1),
        }

        for timestamp in first_release.values():
            self.store_event(
                data={"release": "1.0", "timestamp": iso_format(timestamp)},
                project_id=self.project.id,
            )
        self.store_event(
            data={"release": "1.1", "timestamp": iso_format(before_now(minutes=2))},
            project_id=self.project.id,
        )
        event = None
        for timestamp in last_release.values():
            event = self.store_event(
                data={"release": "1.0a", "timestamp": iso_format(timestamp)},
                project_id=self.project.id,
            )

        group = event.group

        url = f"/api/0/issues/{group.id}/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(group.id)
        release = response.data["firstRelease"]
        assert release["version"] == "1.0"
        for event, timestamp in first_release.items():
            assert release[event].ctime() == timestamp.ctime()
        release = response.data["lastRelease"]
        assert release["version"] == "1.0a"
        for event, timestamp in last_release.items():
            assert release[event].ctime() == timestamp.ctime()

    def test_first_last_only_one_tagstore(self):
        self.login_as(user=self.user)

        event = self.store_event(
            data={"release": "1.0", "timestamp": iso_format(before_now(days=3))},
            project_id=self.project.id,
        )
        self.store_event(
            data={"release": "1.1", "timestamp": iso_format(before_now(minutes=3))},
            project_id=self.project.id,
        )

        group = event.group

        url = f"/api/0/issues/{group.id}/"

        with mock.patch(
            "sentry.api.endpoints.group_details.tagstore.get_release_tags"
        ) as get_release_tags:
            response = self.client.get(url, format="json")
            assert response.status_code == 200
            assert get_release_tags.call_count == 1

    def test_first_release_only(self):
        self.login_as(user=self.user)

        first_event = before_now(days=3)

        self.store_event(
            data={"release": "1.0", "timestamp": iso_format(first_event)},
            project_id=self.project.id,
        )
        event = self.store_event(
            data={"release": "1.1", "timestamp": iso_format(before_now(days=1))},
            project_id=self.project.id,
        )
        # Forcibly remove one of the releases
        Release.objects.get(version="1.1").delete()

        group = event.group

        url = f"/api/0/issues/{group.id}/"

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["firstRelease"]["version"] == "1.0"
        # only one event
        assert (
            response.data["firstRelease"]["firstEvent"]
            == response.data["firstRelease"]["lastEvent"]
        )
        assert response.data["firstRelease"]["firstEvent"].ctime() == first_event.ctime()
        assert response.data["lastRelease"] is None

    def test_group_expand_inbox(self):
        self.login_as(user=self.user)

        event = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=3))},
            project_id=self.project.id,
        )
        group = event.group
        add_group_to_inbox(group, GroupInboxReason.NEW)

        url = f"/api/0/issues/{group.id}/?expand=inbox"

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["inbox"] is not None
        assert response.data["inbox"]["reason"] == GroupInboxReason.NEW.value
        assert response.data["inbox"]["reason_details"] is None
        remove_group_from_inbox(event.group)
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["inbox"] is None

    def test_assigned_to_unknown(self):
        self.login_as(user=self.user)
        event = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=3))},
            project_id=self.project.id,
        )
        group = event.group
        url = f"/api/0/issues/{group.id}/"
        response = self.client.put(
            url, {"assignedTo": "admin@localhost", "status": "unresolved"}, format="json"
        )
        assert response.status_code == 200
        response = self.client.put(
            url, {"assignedTo": "user@doesnotexist.com", "status": "unresolved"}, format="json"
        )
        assert response.status_code == 400
        assert response.data == {
            "assignedTo": [
                ErrorDetail(
                    string="Could not parse actor. Format should be `type:id` where type is `team` or `user`.",
                    code="invalid",
                )
            ]
        }
