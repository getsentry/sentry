from __future__ import annotations

from io import BytesIO
from typing import ClassVar, Self
from urllib.parse import urljoin
from uuid import uuid4

from django.core.exceptions import ObjectDoesNotExist
from django.db import models, router
from django.utils.encoding import force_bytes
from PIL import Image

from sentry import options
from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model
from sentry.models.files.control_file import ControlFile
from sentry.models.files.file import File
from sentry.silo.base import SiloMode
from sentry.types.region import get_local_region
from sentry.utils.cache import cache
from sentry.utils.db import atomic_transaction


class AvatarBase(Model):
    """
    Base class for UserAvatar, OrganizationAvatar, and SentryAppAvatar models. Associates those entities with their
    avatar preferences/files. If extending this class, ensure the model has avatar_type.
    """

    __relocation_scope__ = RelocationScope.Excluded

    ALLOWED_SIZES: ClassVar[tuple[int, ...]] = (20, 32, 36, 48, 52, 64, 80, 96, 120)

    # abstract
    AVATAR_TYPES: ClassVar[tuple[tuple[int, str], ...]]
    FILE_TYPE: ClassVar[str]
    avatar_type: models.Field[int, int]

    ident = models.CharField(max_length=32, unique=True, db_index=True)

    class Meta:
        abstract = True

    url_path = "avatar"

    def save(self, *args, **kwargs):
        if not self.ident:
            self.ident = uuid4().hex
        return super().save(*args, **kwargs)

    def get_file(self):
        file_id = getattr(self, self.file_write_fk(), None)
        if file_id is None:
            return None

        file_class = self.file_class()
        try:
            return file_class.objects.get(pk=file_id)
        except ObjectDoesNotExist:
            # Best effort replication of previous behaviour with foreign key
            # which was set with on_delete=models.SET_NULL
            update = {self.file_fk(): None}
            self.update(**update)
            return None

    def delete(self, *args, **kwargs):
        file = self.get_file()
        if file:
            file.delete()
        return super().delete(*args, **kwargs)

    def get_cache_key(self, size):
        raise NotImplementedError

    def clear_cached_photos(self):
        cache.delete_many([self.get_cache_key(x) for x in self.ALLOWED_SIZES])

    def get_cached_photo(self, size):
        file = self.get_file()
        if not file:
            return
        if size not in self.ALLOWED_SIZES:
            size = min(self.ALLOWED_SIZES, key=lambda x: abs(x - size))
        cache_key = self.get_cache_key(size)
        photo = cache.get(cache_key)
        if photo is None:
            photo_file = file.getfile()
            with Image.open(photo_file) as image:
                image = image.resize((size, size), Image.LANCZOS)
                image_file = BytesIO()
                image.save(image_file, "PNG")
                photo = image_file.getvalue()
                cache.set(cache_key, photo)
        return photo

    def file_class(self) -> type[File] | type[ControlFile]:
        return File

    def file_fk(self) -> str:
        """
        Get the foreign key currently used by this record for blob storage.
        Varies in ControlAvatarBase
        """
        return "file_id"

    def file_write_fk(self) -> str:
        """
        Get the foreign key that should be used for writes.
        Varies in ControlAvatarBase
        """
        return "file_id"

    def absolute_url(self) -> str:
        """
        Get the absolute URL to an avatar.

        Use the implementing class's silo_limit to infer which
        host name should be used.
        """
        cls = type(self)

        url_base = options.get("system.url-prefix")
        silo_limit = getattr(cls._meta, "silo_limit", None)
        if silo_limit is not None and SiloMode.REGION in silo_limit.modes:
            url_base = get_local_region().to_url("")

        return urljoin(url_base, f"/{self.url_path}/{self.ident}/")

    @classmethod
    def save_avatar(cls, relation, type, avatar=None, filename=None, color=None) -> Self:
        if avatar:
            # Create an instance of the current class so we can
            # access where new files should be stored.
            dummy = cls()
            file_class = dummy.file_class()
            with atomic_transaction(using=router.db_for_write(file_class)):
                photo = file_class.objects.create(name=filename, type=cls.FILE_TYPE)
                # XXX: Avatar may come in as a string instance in python2
                # if it's not wrapped in BytesIO.
                if isinstance(avatar, str):
                    avatar = BytesIO(force_bytes(avatar))

                # XXX: Avatar processing may adjust file position; reset before saving.
                avatar.seek(0)
                photo.putfile(avatar)
        else:
            photo = None

        with atomic_transaction(
            using=router.db_for_write(cls),
        ):
            if relation.get("sentry_app") and color is not None:
                instance, created = cls.objects.get_or_create(**relation, color=color)
            else:
                instance, created = cls.objects.get_or_create(**relation)
            file = instance.get_file()
            if file and photo:
                file.delete()

            if photo:
                if instance.file_fk() != instance.file_write_fk():
                    setattr(instance, instance.file_fk(), None)
                setattr(instance, instance.file_write_fk(), photo.id)
                instance.ident = uuid4().hex

            instance.avatar_type = [i for i, n in cls.AVATAR_TYPES if n == type][0]
            instance.save()

        if photo and not created:
            instance.clear_cached_photos()

        return instance
