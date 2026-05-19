import logging

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)

TICKET_ACTION_TYPES = ["github", "github_enterprise", "jira", "jira_server", "vsts"]


def _extract_choice_label(value: object, label: object) -> tuple[object, bool]:
    """
    In the past, the frontend was able to store a serialized React element as a choice label.
    This was previously supported, but will now cause the page to crash. This migration will
    extract the proper label text from the serialized React element.

    All existing serialized React elements look like the following:

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
    if isinstance(label, (str, int, float)) or label is None:
        return label, False

    if isinstance(label, dict) and "props" in label:
        children = label.get("props", {}).get("children")
        if isinstance(children, list):
            text = "".join(c for c in children if isinstance(c, str)).strip()
            if text:
                return text, True
        return str(value) if value is not None else "", True

    return str(value) if value is not None else "", True


def sanitize_dynamic_form_field_choices(
    apps: StateApps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    Action = apps.get_model("workflow_engine", "Action")

    count = 0
    updated = 0

    for action in RangeQuerySetWrapper(Action.objects.filter(type__in=TICKET_ACTION_TYPES)):
        count += 1
        if count % 1000 == 0:
            logger.info(
                "sanitize_dynamic_form_field_choices.progress",
                extra={
                    "count": count,
                    "updated": updated,
                    "current_action_id": action.id,
                },
            )

        dynamic_form_fields = (action.data or {}).get("dynamic_form_fields")
        if not dynamic_form_fields or not isinstance(dynamic_form_fields, list):
            continue

        row_changed = False

        for field_def in dynamic_form_fields:
            if not isinstance(field_def, dict):
                continue

            choices = field_def.get("choices")
            if not choices or not isinstance(choices, list):
                continue

            for choice in choices:
                if not isinstance(choice, list) or len(choice) < 2:
                    continue

                new_label, was_changed = _extract_choice_label(choice[0], choice[1])
                if was_changed and new_label:
                    choice[1] = new_label
                    row_changed = True

        if row_changed:
            action.save(update_fields=["data"])
            updated += 1

    logger.info(
        "sanitize_dynamic_form_field_choices.complete",
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
        ("workflow_engine", "0113_migrate_data_conditions_categories"),
    ]

    operations = [
        migrations.RunPython(
            code=sanitize_dynamic_form_field_choices,
            reverse_code=migrations.RunPython.noop,
            hints={"tables": ["workflow_engine_action"]},
        ),
    ]
