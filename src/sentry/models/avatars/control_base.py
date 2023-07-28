from sentry.db.models import BoundedBigIntegerField
from sentry.models.avatars.base import AvatarBase
from sentry.models.files import ControlFileBlob, File


class ControlAvatarBase(AvatarBase):
    control_file_id = BoundedBigIntegerField(unique=True, null=True)

    class Meta:
        abstract = True

    @classmethod
    def file_class(cls):
        from sentry.models import ControlFile

        if ControlFileBlob._storage_config():
            return ControlFile
        return File

    @classmethod
    def file_fk(cls) -> str:
        if ControlFileBlob._storage_config():
            return "control_file_id"
        return "file_id"

    @property
    def get_file_id(self):
        return self.control_file_id or self.file_id
