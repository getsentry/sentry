from sentry.db.models import BoundedBigIntegerField
from sentry.models.avatars.base import AvatarBase


class ControlAvatarBase(AvatarBase):
    control_file_id = BoundedBigIntegerField(unique=True, null=True)

    class Meta:
        abstract = True

    @classmethod
    def file_class(cls):
        from sentry.models import ControlFile

        return ControlFile

    @classmethod
    def file_fk(cls) -> str:
        return "control_file_id"

    @classmethod
    def save_avatar(cls, relation, type, avatar=None, filename=None, color=None):
        instance = super().save_avatar(cls, relation, type, avatar, filename, color)
        ...
        return instance
