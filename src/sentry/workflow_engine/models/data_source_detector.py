from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


@region_silo_model
class DataSourceDetector(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    data_source = FlexibleForeignKey("workflow_engine.DataSource")
    detector = FlexibleForeignKey("workflow_engine.Detector")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["data_source", "detector"],
                name="workflow_engine_uniq_datasource_detector",
            )
        ]
