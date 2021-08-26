from enum import Enum

from django.db import models

from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey


class TransactionMetric(Enum):
    DURATION = 1
    LCP = 2


TRANSACTION_METRICS = {
    TransactionMetric.DURATION.value: "duration",
    TransactionMetric.LCP.value: "lcp",
}


class ProjectTransactionThresholdOverride(DefaultFieldsModel):
    __include_in_export__ = False

    # max_length here is based on the maximum for transactions in relay
    transaction = models.CharField(max_length=200)
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    organization = FlexibleForeignKey("sentry.Organization")
    threshold = models.IntegerField()
    metric = models.PositiveSmallIntegerField(default=TransactionMetric.DURATION.value)
    edited_by = FlexibleForeignKey(
        "sentry.User", null=True, on_delete=models.SET_NULL, db_constraint=False
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projecttransactionthresholdoverride"
        unique_together = (("project", "transaction"),)


class ProjectTransactionThreshold(DefaultFieldsModel):
    __include_in_export__ = False

    project = FlexibleForeignKey("sentry.Project", unique=True, db_constraint=False)
    organization = FlexibleForeignKey("sentry.Organization")
    threshold = models.IntegerField()
    metric = models.PositiveSmallIntegerField(default=TransactionMetric.DURATION.value)
    edited_by = FlexibleForeignKey(
        "sentry.User", null=True, on_delete=models.SET_NULL, db_constraint=False
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projecttransactionthreshold"
