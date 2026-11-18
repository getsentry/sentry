from django.db.migrations.state import StateApps

from sentry.testutils.cases import TestMigrations


class ConvertSeerWorkflowActionsTest(TestMigrations):
    app = "seer"
    migrate_from = "0046_add_workflow_config_backing_workflow"
    migrate_to = "0047_convert_seer_workflow_actions"

    def setup_before_migration(self, apps: StateApps) -> None:
        Action = apps.get_model("workflow_engine", "Action")
        self.seer_action = Action.objects.create(type="seer_workflow", config={}, data={})
        self.email_action = Action.objects.create(type="email", config={}, data={})

    def test_converts_only_seer_workflow_actions(self) -> None:
        self.seer_action.refresh_from_db()
        self.email_action.refresh_from_db()
        assert self.seer_action.type == "seer_investigation"
        assert self.email_action.type == "email"
