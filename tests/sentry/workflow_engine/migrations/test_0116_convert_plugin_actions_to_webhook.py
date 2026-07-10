from sentry.testutils.cases import TestMigrations

WEBHOOK_CONFIG = {"target_identifier": "webhooks", "target_display": None, "target_type": None}


class ConvertPluginActionsToWebhookTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0115_add_group_index_to_wfh"
    migrate_to = "0116_convert_plugin_actions_to_webhook"

    def _make_linked_action(self, apps, project, action_type):
        """Create an Action reachable from ``project`` via the FK chain used to resolve the project:
        Detector -> DetectorWorkflow -> Workflow -> WorkflowDataConditionGroup -> DataConditionGroup
        -> DataConditionGroupAction -> Action. Returns the action id."""
        Detector = apps.get_model("workflow_engine", "Detector")
        DetectorWorkflow = apps.get_model("workflow_engine", "DetectorWorkflow")
        Workflow = apps.get_model("workflow_engine", "Workflow")
        DataConditionGroup = apps.get_model("workflow_engine", "DataConditionGroup")
        WorkflowDataConditionGroup = apps.get_model("workflow_engine", "WorkflowDataConditionGroup")
        DataConditionGroupAction = apps.get_model("workflow_engine", "DataConditionGroupAction")
        Action = apps.get_model("workflow_engine", "Action")

        detector = Detector.objects.create(project_id=project.id, name="det", type="error")
        workflow = Workflow.objects.create(organization_id=project.organization_id, name="wf")
        DetectorWorkflow.objects.create(detector_id=detector.id, workflow_id=workflow.id)
        dcg = DataConditionGroup.objects.create(organization_id=project.organization_id)
        WorkflowDataConditionGroup.objects.create(
            workflow_id=workflow.id, condition_group_id=dcg.id
        )
        action = Action.objects.create(type=action_type, config={}, data={})
        DataConditionGroupAction.objects.create(condition_group_id=dcg.id, action_id=action.id)
        return action.id, dcg.id

    def setup_before_migration(self, apps):
        ProjectOption = apps.get_model("sentry", "ProjectOption")
        Action = apps.get_model("workflow_engine", "Action")
        DataConditionGroupAction = apps.get_model("workflow_engine", "DataConditionGroupAction")

        enabled_project = self.create_project(organization=self.organization)
        disabled_project = self.create_project(organization=self.organization)
        unconfigured_project = self.create_project(organization=self.organization)
        # enabled + disabled both have a webhooks:enabled option row -> both configured
        ProjectOption.objects.create(
            project_id=enabled_project.id, key="webhooks:enabled", value=True
        )
        ProjectOption.objects.create(
            project_id=disabled_project.id, key="webhooks:enabled", value=False
        )
        # unconfigured_project has no webhooks:enabled option at all

        # configured (enabled) project -> converted
        self.enabled_action_id, _ = self._make_linked_action(apps, enabled_project, "plugin")

        # configured (disabled) project -> still converted (config exists, may be re-enabled)
        self.disabled_action_id, _ = self._make_linked_action(apps, disabled_project, "plugin")

        # never-configured project -> left as plugin (deleted later in 0117)
        self.unconfigured_action_id, _ = self._make_linked_action(
            apps, unconfigured_project, "plugin"
        )

        # orphan plugin action with no chain -> left as plugin
        self.orphan_action_id = Action.objects.create(type="plugin", config={}, data={}).id

        # non-plugin action -> untouched
        self.email_action_id, _ = self._make_linked_action(apps, enabled_project, "email")

        # no-dedup: enabled group already has a webhook("webhooks") action alongside a plugin one
        self.dedup_plugin_action_id, dedup_dcg_id = self._make_linked_action(
            apps, enabled_project, "plugin"
        )
        self.dedup_dcg_id = dedup_dcg_id
        existing_webhook = Action.objects.create(
            type="webhook", config=dict(WEBHOOK_CONFIG), data={}
        )
        DataConditionGroupAction.objects.create(
            condition_group_id=dedup_dcg_id, action_id=existing_webhook.id
        )
        self.existing_webhook_action_id = existing_webhook.id

    def test_converts_configured_projects_only(self):
        from sentry.workflow_engine.models import Action, DataConditionGroupAction

        # enabled + disabled (both configured) convert in place; config/data match the dual-write
        enabled = Action.objects.get(id=self.enabled_action_id)
        assert enabled.type == "webhook"
        assert enabled.config == WEBHOOK_CONFIG
        assert enabled.data == {}
        assert DataConditionGroupAction.objects.filter(action_id=self.enabled_action_id).exists()

        assert Action.objects.get(id=self.disabled_action_id).type == "webhook"

        # never-configured + orphan stay plugin (deletion is 0117's job)
        assert Action.objects.get(id=self.unconfigured_action_id).type == "plugin"
        assert Action.objects.get(id=self.orphan_action_id).type == "plugin"

        # non-plugin action untouched
        assert Action.objects.get(id=self.email_action_id).type == "email"

        # no dedup: converted plugin + pre-existing webhook both remain in the group
        assert Action.objects.get(id=self.dedup_plugin_action_id).type == "webhook"
        assert Action.objects.get(id=self.existing_webhook_action_id).type == "webhook"
        webhook_actions_in_group = Action.objects.filter(
            id__in=DataConditionGroupAction.objects.filter(
                condition_group_id=self.dedup_dcg_id
            ).values_list("action_id", flat=True),
            type="webhook",
        )
        assert webhook_actions_in_group.count() == 2
