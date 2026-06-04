from django.db import models

from sentry.db.models import FlexibleForeignKey


class OtherTable(models.Model):
    pass


class M2MTable(models.Model):
    alert_rule = FlexibleForeignKey(OtherTable)
    test_table = FlexibleForeignKey(
        "good_flow_delete_field_pending_with_not_null_m2m_app.TestTable"
    )


class TestTable(models.Model):
    excluded_projects = models.ManyToManyField(OtherTable, through=M2MTable)
