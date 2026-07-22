from sentry.issues.action_log.publish import publish_action
from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    ActionSource,
    GroupAction,
    GroupActionActor,
    ResolveAction,
    ViewAction,
)
from sentry.issues.derived.processing import PIPELINE, process_group_log
from sentry.models.group import Group
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner


def _publish(*, group: Group, action: GroupAction, actor: GroupActionActor = SYSTEM_ACTOR) -> None:
    with outbox_runner():
        publish_action(
            action,
            source=ActionSource.API,
            group_id=group.id,
            project=group.project,
            actor=actor,
        )


@with_feature("projects:issue-action-log-write-to-db")
class DebugGroupDerivedDataEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-group-derived-data-debug"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.group = self.create_group(project=self.project)

    def test_no_derived_data(self) -> None:
        response = self.get_success_response(self.organization.slug, self.group.id, status_code=200)
        assert response.data["groupId"] == str(self.group.id)
        assert response.data["stored"] is None
        assert response.data["computed"] is not None
        assert response.data["entryCount"] == 0
        assert response.data["truncated"] is False

    def test_with_stored_and_computed(self) -> None:
        _publish(group=self.group, action=ViewAction())
        _publish(group=self.group, action=ViewAction())
        _publish(group=self.group, action=ResolveAction())
        process_group_log(self.group.id)

        response = self.get_success_response(self.organization.slug, self.group.id, status_code=200)
        assert response.data["stored"] is not None
        assert response.data["stored"]["state"]["view_count"] == 2
        assert response.data["stored"]["state"]["status"] == "closed"
        assert response.data["computed"] is not None
        assert response.data["computed"]["view_count"] == 2
        assert response.data["computed"]["status"] == "closed"
        assert response.data["entryCount"] == 3
        assert response.data["pipelineHash"] == PIPELINE.pipeline_hash

    def test_truncated_when_over_limit(self) -> None:
        for _ in range(3):
            _publish(group=self.group, action=ViewAction())

        response = self.get_success_response(
            self.organization.slug, self.group.id, qs_params={"limit": "2"}, status_code=200
        )
        assert response.data["truncated"] is True
        assert response.data["computed"] is None
        assert response.data["entryCount"] is None
        assert response.data["limit"] == 2

    def test_invalid_limit(self) -> None:
        self.get_error_response(
            self.organization.slug, self.group.id, qs_params={"limit": "abc"}, status_code=400
        )

    def test_zero_limit(self) -> None:
        self.get_error_response(
            self.organization.slug, self.group.id, qs_params={"limit": "0"}, status_code=400
        )

    def test_negative_limit(self) -> None:
        self.get_error_response(
            self.organization.slug, self.group.id, qs_params={"limit": "-1"}, status_code=400
        )

    def test_over_max_limit(self) -> None:
        self.get_error_response(
            self.organization.slug, self.group.id, qs_params={"limit": "10001"}, status_code=400
        )
