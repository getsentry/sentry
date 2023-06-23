from sentry.db.models import BoundedBigIntegerField, Model


class AbstractFileBlobOwner(Model):
    __include_in_export__ = False

    organization_id = BoundedBigIntegerField(db_index=True)

    class Meta:
        abstract = True
