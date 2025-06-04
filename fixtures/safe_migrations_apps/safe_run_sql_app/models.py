from django.db import models

from sentry.db.models import BoundedPositiveIntegerField


class TestTable(models.Model):
    field = BoundedPositiveIntegerField(default=0)
