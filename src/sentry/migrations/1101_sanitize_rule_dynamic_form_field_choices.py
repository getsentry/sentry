import logging

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)

# The legacy issue-alert ticket-create actions whose `data.dynamic_form_fields`
# can hold corrupted choice labels left behind by the old AbstractExternalIssueForm.
# Mirrors the action types covered by workflow_engine migration 0114.
TICKET_ACTION_IDS = frozenset(
    [
        "sentry.integrations.github.notify_action.GitHubCreateTicketAction",
        "sentry.integrations.github_enterprise.notify_action.GitHubEnterpriseCreateTicketAction",
        "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
        "sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction",
        "sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction",
    ]
)


def _extract_choice_label(value: object, label: object) -> tuple[object, bool]:
    """
    The legacy frontend persisted React elements as choice labels. JSON
    serialization stripped $$typeof (Symbol) and type (function), leaving
    plain {key, ref, props} shells which the new form components reject.

    Recover the readable text from props.children when possible; otherwise
    fall back to the choice value so the row at least renders.

    All serialized React elements look like:

    ```
    {
        "key": None,
        "ref": None,
        "props": {
            "children": [
                {...},
                " ",
                "This is the actual label text",
            ]
        }
    }
    ```
    """
    if isinstance(label, dict) and "props" in label:
        props = label.get("props")
        children = props.get("children") if isinstance(props, dict) else None
        if isinstance(children, list):
            text = "".join(c for c in children if isinstance(c, str)).strip()
            if text:
                return text, True

        return value, True

    return label, False


def sanitize_rule_dynamic_form_field_choices(
    apps: StateApps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    Rule = apps.get_model("sentry", "Rule")

    count = 0
    updated = 0

    for rule in RangeQuerySetWrapper(Rule.objects.all()):
        count += 1

        actions = (rule.data or {}).get("actions")
        if not isinstance(actions, list):
            continue

        row_changed = False

        for action in actions:
            if not isinstance(action, dict):
                continue
            if action.get("id") not in TICKET_ACTION_IDS:
                continue

            dynamic_form_fields = action.get("dynamic_form_fields")
            if not isinstance(dynamic_form_fields, list):
                continue

            for field_def in dynamic_form_fields:
                if not isinstance(field_def, dict):
                    continue

                choices = field_def.get("choices")
                if not isinstance(choices, list):
                    continue

                for choice in choices:
                    if not isinstance(choice, list) or len(choice) < 2:
                        continue

                    new_label, was_changed = _extract_choice_label(choice[0], choice[1])
                    if was_changed:
                        choice[1] = new_label
                        row_changed = True

        if row_changed:
            rule.save(update_fields=["data"])
            updated += 1

        if count % 1000 == 0:
            logger.info(
                "sanitize_rule_dynamic_form_field_choices.progress",
                extra={
                    "count": count,
                    "updated": updated,
                    "current_rule_id": rule.id,
                },
            )

    logger.info(
        "sanitize_rule_dynamic_form_field_choices.complete",
        extra={
            "count": count,
            "updated": updated,
        },
    )


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production.
    # This should only be used for operations where it's safe to run the migration after your
    # code has deployed. So this should not be used for most operations that alter the schema
    # of a table.
    # Here are some things that make sense to mark as post deployment:
    # - Large data migrations. Typically we want these to be run manually so that they can be
    #   monitored and not block the deploy for a long period of time while they run.
    # - Adding indexes to large tables. Since this can take a long time, we'd generally prefer to
    #   run this outside deployments so that we don't block them. Note that while adding an index
    #   is a schema change, it's completely safe to run the operation after the code has deployed.
    # Once deployed, run these manually via: https://develop.sentry.dev/database-migrations/#migration-deployment

    is_post_deployment = True

    dependencies = [
        ("sentry", "1100_add_relocation_file_bucket_path"),
    ]

    operations = [
        migrations.RunPython(
            code=sanitize_rule_dynamic_form_field_choices,
            reverse_code=migrations.RunPython.noop,
            hints={"tables": ["sentry_rule"]},
        ),
    ]
