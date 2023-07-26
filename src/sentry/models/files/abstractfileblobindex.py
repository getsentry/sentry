from sentry.db.models import BoundedPositiveIntegerField, Model


class AbstractFileBlobIndex(Model):
    __include_in_export__ = False

    offset = BoundedPositiveIntegerField()

    class Meta:
        abstract = True
