from unittest import mock

from rest_framework.exceptions import ErrorDetail

from sentry import tsdb
from sentry.issues.forecasts import generate_and_save_forecasts
from sentry.models.environment import Environment
from sentry.models.groupinbox import GroupInboxReason, add_group_to_inbox, remove_group_from_inbox
from sentry.models.groupowner import GROUP_OWNER_TYPE, GroupOwner, GroupOwnerType
from sentry.models.release import Release
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


@region_silo_test
class GroupDetailsTest(APITestCase, SnubaTestCase):
    def test_multiple_environments(self):
        group = self.create_group()
        self.login_as(user=self.user)

        environment = Environment.get_or_create(group.project, "production")
        environment2 = Environment.get_or_create(group.project, "staging")

        url = f"/api/0/issues/{group.id}/"

        with mock.patch(
            "sentry.api.endpoints.group_details.tsdb.backend.get_range",
            side_effect=tsdb.backend.get_range,
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
        event = [
            self.store_event(
                data={"release": "1.0a", "timestamp": iso_format(timestamp)},
                project_id=self.project.id,
            )
            for timestamp in last_release.values()
        ][-1]
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

        with mock.patch("sentry.tagstore.backend.get_release_tags") as get_release_tags:
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

    def test_group_expand_owners(self):
        self.login_as(user=self.user)
        event = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        group = event.group
        url = f"/api/0/issues/{group.id}/?expand=owners"

        self.login_as(user=self.user)
        # Test with no owner
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["owners"] is None

        # Test with owners
        GroupOwner.objects.create(
            group=event.group,
            project=event.project,
            organization=event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=self.user.id,
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["owners"] is not None
        assert len(response.data["owners"]) == 1
        assert response.data["owners"][0]["owner"] == f"user:{self.user.id}"
        assert response.data["owners"][0]["type"] == GROUP_OWNER_TYPE[GroupOwnerType.SUSPECT_COMMIT]

    def test_group_expand_forecasts(self):
        with Feature("organizations:escalating-issues"):
            self.login_as(user=self.user)
            event = self.store_event(
                data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
                project_id=self.project.id,
            )
            group = event.group
            generate_and_save_forecasts([group])

            url = f"/api/0/issues/{group.id}/?expand=forecast"

            response = self.client.get(url, format="json")
            assert response.status_code == 200, response.content
            assert response.data["forecast"] is not None
            assert response.data["forecast"]["data"] is not None
            assert response.data["forecast"]["date_added"] is not None

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

    def test_collapse_stats_does_not_work(self):
        """
        'collapse' param should hide the stats data and not return anything in the response, but the impl
        doesn't seem to respect this param.

        include this test here in-case the endpoint behavior changes in the future.
        """
        self.login_as(user=self.user)

        event = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=3))},
            project_id=self.project.id,
        )
        group = event.group

        url = f"/api/0/issues/{group.id}/"

        response = self.client.get(url, {"collapse": ["stats"]}, format="json")
        assert response.status_code == 200
        assert int(response.data["id"]) == event.group.id
        assert response.data["stats"]  # key shouldn't be present
        assert response.data["count"] is not None  # key shouldn't be present
        assert response.data["userCount"] is not None  # key shouldn't be present
        assert response.data["firstSeen"] is not None  # key shouldn't be present
        assert response.data["lastSeen"] is not None  # key shouldn't be present

    def test_issue_type_category(self):
        """Test that the issue's type and category is returned in the results"""

        self.login_as(user=self.user)

        event = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=3))},
            project_id=self.project.id,
        )

        url = f"/api/0/issues/{event.group.id}/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert int(response.data["id"]) == event.group.id
        assert response.data["issueType"] == "error"
        assert response.data["issueCategory"] == "error"
