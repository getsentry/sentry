from django.db import models


class TestTable(models.Model):
    name = models.CharField(max_length=32, null=True)
