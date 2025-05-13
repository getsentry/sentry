import pytest

from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("Timeout failures—skipping these tests, which pass, to unblock migration.")
class TestRenameAzureDevopsActionToVsts(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0059_fix_high_priority_condition_triggers"
    migrate_to = "0060_rename_azure_devops_action_to_vsts"

    def setup_initial_state(self):
        # Create actions that should be renamed
        self.azure_action1 = self.create_action()
        # Need to manually update the type so the validation signals don't run
        self.azure_action1.update(
            type="azure_devops", config={"target_identifier": None, "target_type": 0}, data={}
        )

        self.azure_action2 = self.create_action()
        self.azure_action2.update(
            type="azure_devops", config={"target_identifier": None, "target_type": 0}, data={}
        )

        # Don't rename this action
        # Defaults to a slack action
        self.slack_action = self.create_action()

    def test(self):
        self.azure_action1.refresh_from_db()
        assert self.azure_action1.type == "vsts"

        self.azure_action2.refresh_from_db()
        assert self.azure_action2.type == "vsts"

        self.slack_action.refresh_from_db()
        assert self.slack_action.type == "slack"
