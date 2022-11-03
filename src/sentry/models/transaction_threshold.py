from enum import Enum

from django.db import models

from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_only_model
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text


class TransactionMetric(Enum):
    DURATION = 1
    LCP = 2


TRANSACTION_METRICS = {
    TransactionMetric.DURATION.value: "duration",
    TransactionMetric.LCP.value: "lcp",
}


@region_silo_only_model
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

    @classmethod
    def get_cache_key(cls, project_ids, org_id, order_by, value_list):
        return "sentry_projecttransactionthreshold:{}".format(
            md5_text(f"{project_ids}:{org_id}:{order_by}:{value_list}").hexdigest()
        )

    @classmethod
    def filter(cls, project_id__in, organization_id, order_by, value_list):
        cache_key = cls.get_cache_key(project_id__in, organization_id, order_by, value_list)

        cache_result = cache.get(cache_key)
        if cache_result is None:
            result = list(
                cls.objects.filter(
                    project_id__in=project_id__in,
                    organization_id=organization_id,
                )
                .order_by(*order_by)
                .values_list(*value_list)
            )

            cache.set(cache_key, result, 3600)
            return result
        else:
            return cache_result


@region_silo_only_model
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

    @classmethod
    def get_cache_key(cls, project_ids, org_id, order_by, value_list):
        return "sentry_projecttransactionthreshold:{}".format(
            md5_text(f"{project_ids}:{org_id}:{order_by}:{value_list}").hexdigest()
        )

    @classmethod
    def filter(cls, project_id__in, organization_id, order_by, value_list):
        cache_key = cls.get_cache_key(project_id__in, organization_id, order_by, value_list)

        cache_result = cache.get(cache_key)
        if cache_result is None:
            result = list(
                cls.objects.filter(
                    project_id__in=project_id__in,
                    organization_id=organization_id,
                )
                .order_by(*order_by)
                .values_list(*value_list)
            )

            cache.set(cache_key, result, 3600)
            return result
        else:
            return cache_result
