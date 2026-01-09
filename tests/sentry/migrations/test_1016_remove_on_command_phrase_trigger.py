from sentry.models.options.organization_option import OrganizationOption
from sentry.testutils.cases import TestMigrations


class RemoveOnCommandPhraseTriggerTest(TestMigrations):
    migrate_from = "1015_backfill_self_hosted_sentry_app_emails"
    migrate_to = "1016_remove_on_command_phrase_trigger"

    def setup_initial_state(self) -> None:
        self.org_with_trigger = self.create_organization(name="org_with_trigger")
        self.org_without_trigger = self.create_organization(name="org_without_trigger")
        self.org_with_different_key = self.create_organization(name="org_with_different_key")
        self.org_with_none_value = self.create_organization(name="org_with_none_value")

        # Org with on_command_phrase that should be removed
        OrganizationOption.objects.set_value(
            self.org_with_trigger,
            "sentry:default_code_review_triggers",
            ["on_command_phrase", "on_ready_for_review", "on_new_commit"],
        )

        # Org without on_command_phrase, should remain unchanged
        OrganizationOption.objects.set_value(
            self.org_without_trigger,
            "sentry:default_code_review_triggers",
            ["on_ready_for_review", "on_new_commit"],
        )

        # Org with different key that contains on_command_phrase, should remain unchanged
        OrganizationOption.objects.set_value(
            self.org_with_different_key,
            "sentry:some_other_key",
            ["on_command_phrase", "other_value"],
        )

        # Org with None value, should remain unchanged
        OrganizationOption.objects.set_value(
            self.org_with_none_value,
            "sentry:default_code_review_triggers",
            None,
        )

    def test(self) -> None:
        # Query directly from database to bypass cache
        # Verify org with trigger: on_command_phrase removed, others remain
        org_option = OrganizationOption.objects.get(
            organization=self.org_with_trigger, key="sentry:default_code_review_triggers"
        )
        assert org_option.value == ["on_ready_for_review", "on_new_commit"]
        assert "on_command_phrase" not in org_option.value

        # Verify org without trigger: unchanged
        org_option = OrganizationOption.objects.get(
            organization=self.org_without_trigger, key="sentry:default_code_review_triggers"
        )
        assert org_option.value == ["on_ready_for_review", "on_new_commit"]
        assert "on_command_phrase" not in org_option.value

        # Verify org with different key: unchanged (migration only affects specific key)
        org_option = OrganizationOption.objects.get(
            organization=self.org_with_different_key, key="sentry:some_other_key"
        )
        assert org_option.value == ["on_command_phrase", "other_value"]

        # Verify org with None value: unchanged
        org_option = OrganizationOption.objects.get(
            organization=self.org_with_none_value, key="sentry:default_code_review_triggers"
        )
        assert org_option.value is None
