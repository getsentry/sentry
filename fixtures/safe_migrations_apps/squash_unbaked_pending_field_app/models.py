from django.db import models


class TestTable(models.Model):
    # The naive squash forgot the pending state, so the column is regenerated as an
    # ordinary field with no pending registration. See the migrations.
    field = models.IntegerField(null=True)
