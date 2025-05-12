from sentry.testutils.cases import TestMigrations


class TestRenameAzureDevopsActionToVsts(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0059_fix_high_priority_condition_triggers"
    migrate_to = "0060_rename_azure_devops_action_to_vsts"

    def setup_initial_state(self):
        # Create actions that should be renamed
        self.azure_action1 = self.create_action()
        self.azure_action1.update(type="azure_devops")
        self.azure_action1.save()
        self.azure_action2 = self.create_action()
        self.azure_action2.update(type="azure_devops")
        self.azure_action2.save()

        # Don't rename these actions
        self.slack_action = self.create_action(type="slack")
        self.other_action = self.create_action(type="other")

    def test(self):
        self.azure_action1.refresh_from_db()
        assert self.azure_action1.type == "vsts"

        self.azure_action2.refresh_from_db()
        assert self.azure_action2.type == "vsts"

        self.slack_action.refresh_from_db()
        assert self.slack_action.type == "slack"

        self.other_action.refresh_from_db()
        assert self.other_action.type == "other"
