from django.db import models

from sentry.db.models import FlexibleForeignKey


class FkTable(models.Model):
    field = models.IntegerField(default=0, null=False)


class TestTable(models.Model):
    field = models.IntegerField(default=0, null=False)
    fk_table = FlexibleForeignKey(FkTable, db_index=False)
