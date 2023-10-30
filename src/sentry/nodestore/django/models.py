from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BaseModel, region_silo_only_model, sane_repr


@region_silo_only_model
class Node(BaseModel):
    __relocation_scope__ = RelocationScope.Excluded

    id = models.CharField(max_length=40, primary_key=True)
    # TODO(dcramer): this being pickle and not JSON has the ability to cause
    # hard errors as it accepts other serialization than native JSON
    data = models.TextField()
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    __repr__ = sane_repr("timestamp")

    class Meta:
        app_label = "nodestore"
