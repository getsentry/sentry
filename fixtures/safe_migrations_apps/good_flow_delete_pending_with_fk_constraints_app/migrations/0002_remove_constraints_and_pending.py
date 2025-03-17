import django
from django.db import migrations

import sentry
from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    atomic = False

    dependencies = [
        ("good_flow_delete_pending_with_fk_constraints_app", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="TestTable",
            name="fk_table",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                to="good_flow_delete_pending_with_fk_constraints_app.fktable",
                db_index=False,
                db_constraint=False,
            ),
        ),
        SafeDeleteModel(
            name="TestTable",
            deletion_action=DeletionAction.MOVE_TO_PENDING,
        ),
    ]
