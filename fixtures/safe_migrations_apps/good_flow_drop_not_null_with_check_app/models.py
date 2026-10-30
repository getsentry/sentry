from django.db import models


class TestTable(models.Model):
    field = models.IntegerField(null=True)
