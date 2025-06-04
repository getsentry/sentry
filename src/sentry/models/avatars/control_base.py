from sentry.db.models import BoundedBigIntegerField
from sentry.models.avatars.base import AvatarBase
from sentry.models.files import ControlFile


class ControlAvatarBase(AvatarBase):
    control_file_id = BoundedBigIntegerField(unique=True, null=True)

    class Meta:
        abstract = True

    def file_class(self) -> type[ControlFile]:
        """
        Select the file class this avatar has used.
        File classes can vary by the avatar as we have migrated
        storage for saas, but self-hosted and single-tenant instances
        did not have relations and storage migrated.
        """
        return ControlFile

    def file_fk(self) -> str:
        return "control_file_id"

    def file_write_fk(self) -> str:
        """Prefer controlfile as user/sentryapp avatars are stored in control silo"""
        return "control_file_id"

    def get_file_id(self) -> int:
        return self.control_file_id
