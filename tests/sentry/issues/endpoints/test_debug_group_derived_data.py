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


def _url(organization_slug: str, group_id: int) -> str:
    return f"/api/0/organizations/{organization_slug}/issues/{group_id}/derived-data/debug/"


@with_feature("projects:issue-action-log-write-to-db")
class DebugGroupDerivedDataEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.group = self.create_group(project=self.project)

    def test_no_derived_data(self) -> None:
        url = _url(self.organization.slug, self.group.id)
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["groupId"] == str(self.group.id)
        assert response.data["stored"] is None
        assert response.data["recomputed"] is not None
        assert response.data["entryCount"] == 0
        assert response.data["truncated"] is False

    def test_with_stored_and_recomputed(self) -> None:
        _publish(group=self.group, action=ViewAction())
        _publish(group=self.group, action=ViewAction())
        _publish(group=self.group, action=ResolveAction())
        process_group_log(self.group.id)

        url = _url(self.organization.slug, self.group.id)
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["stored"] is not None
        assert response.data["stored"]["state"]["view_count"] == 2
        assert response.data["stored"]["state"]["status"] == "closed"
        assert response.data["recomputed"] is not None
        assert response.data["recomputed"]["view_count"] == 2
        assert response.data["recomputed"]["status"] == "closed"
        assert response.data["entryCount"] == 3
        assert response.data["pipelineHash"] == PIPELINE.pipeline_hash

    def test_truncated_when_over_limit(self) -> None:
        for _ in range(3):
            _publish(group=self.group, action=ViewAction())

        url = _url(self.organization.slug, self.group.id)
        response = self.client.get(url, data={"limit": "2"}, format="json")
        assert response.status_code == 200
        assert response.data["truncated"] is True
        assert response.data["recomputed"] is None
        assert response.data["entryCount"] is None
        assert response.data["limit"] == 2

    def test_invalid_limit(self) -> None:
        url = _url(self.organization.slug, self.group.id)
        response = self.client.get(url, data={"limit": "abc"}, format="json")
        assert response.status_code == 400
        assert "Invalid limit" in response.data["detail"]

    def test_zero_limit(self) -> None:
        url = _url(self.organization.slug, self.group.id)
        response = self.client.get(url, data={"limit": "0"}, format="json")
        assert response.status_code == 400

    def test_negative_limit(self) -> None:
        url = _url(self.organization.slug, self.group.id)
        response = self.client.get(url, data={"limit": "-1"}, format="json")
        assert response.status_code == 400
