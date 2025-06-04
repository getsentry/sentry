from django.db import models


class TestTable(models.Model):
    field = models.CharField(max_length=100)
