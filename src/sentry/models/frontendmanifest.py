"""
sentry.models.frontendmanifest
~~~~~~~~~~~~~~~~~~~~
"""


from django.db import models
from django.utils import timezone

from sentry.db.models import JSONField, Model


class FrontendManifest(Model):
    __include_in_export__ = False

    version = models.CharField(max_length=128, null=False, db_index=True)
    date_created = models.DateTimeField(default=timezone.now)
    manifest = JSONField()
    is_production = models.BooleanField(null=True, db_index=True, default=False)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_frontendmanifest"

        # Adding declarative partial unique indexes is new to django 2.2
        # This means that only one row in the table can have
        # `is_production=True`
        #
        # By default, this constraint is not deferred, meaning inside of
        # a transaction, the constraint will be enforced immediately
        # after every statement and not deferred until the end of the
        # transaction.
        #
        # However, this is not necessary if you order your transaction
        # such that you set `is_production=False` first.  It's possible
        # to configure the `UniqueConstraint` as deferrable, but the
        # declaractive version is not available until django 3.1
        # (https://docs.djangoproject.com/en/3.2/ref/models/constraints/#deferrable)
        #
        # We are opting to keep it simple and order the transactions
        # appropriately
        constraints = [
            models.UniqueConstraint(
                fields=["is_production"],
                name="unique_production_index",
                condition=models.Q(is_production=True),
            )
        ]
