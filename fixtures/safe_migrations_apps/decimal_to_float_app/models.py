from django.db import models


class Value(models.Model):
    amount = models.FloatField(
        null=True,
        default=None,
        blank=True,
    )
