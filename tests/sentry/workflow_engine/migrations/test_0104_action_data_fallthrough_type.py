import pytest

from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.types import FallthroughChoiceType
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import Action


@pytest.mark.skip
class TestActionDataFallthroughType(TestMigrations):
    migrate_from = "0103_add_unique_constraint"
    migrate_to = "0104_action_data_fallthrough_type"
    app = "workflow_engine"

    def setup_initial_state(self) -> None:
        self.org = self.create_organization(name="test-org")
        self.project = self.create_project(organization=self.org)

        self.action = Action.objects.create(
            type="email",
            data={"fallthroughType": FallthroughChoiceType.ACTIVE_MEMBERS},
            config={
                "target_type": ActionTarget.ISSUE_OWNERS,
                "target_identifier": None,
            },
        )
        self.action_no_fallthrough = Action.objects.create(
            type="email",
            data={},
            config={
                "target_type": ActionTarget.USER,
                "target_identifier": str(self.user.id),
            },
        )

    def test_migration(self) -> None:
        fallthrough_action = Action.objects.filter(
            data={"fallthrough_type": FallthroughChoiceType.ACTIVE_MEMBERS}
        )
        assert len(fallthrough_action) == 1

        no_fallthrough_action = Action.objects.filter(data={})
        assert len(no_fallthrough_action) == 1
