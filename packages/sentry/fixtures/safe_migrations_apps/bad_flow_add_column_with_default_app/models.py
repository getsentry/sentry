from django.db import models


class TestTable(models.Model):
    field = models.IntegerField(default=0, null=False)
