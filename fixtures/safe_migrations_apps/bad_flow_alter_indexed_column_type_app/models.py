from django.db import models


class TestTable(models.Model):
    field = models.CharField(max_length=100)

    class Meta:
        indexes = [models.Index(fields=["field"], name="testtable_field_idx")]
