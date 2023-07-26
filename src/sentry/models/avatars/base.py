from __future__ import annotations

from io import BytesIO
from typing import ClassVar
from uuid import uuid4

from django.core.exceptions import ObjectDoesNotExist
from django.db import models, router
from django.utils.encoding import force_bytes
from PIL import Image

from sentry.db.models import BoundedBigIntegerField, Model
from sentry.models.files.file import File
from sentry.tasks.files import copy_file_to_control_and_update_model
from sentry.utils.cache import cache
from sentry.utils.db import atomic_transaction


class AvatarBase(Model):
    """
    Base class for UserAvatar, OrganizationAvatar, TeamAvatar,
    SentryAppAvatar, and ProjectAvatar models. Associates those entities with their
    avatar preferences/files. If extending this class, ensure the model has avatar_type.
    """

    __include_in_export__ = False

    ALLOWED_SIZES: ClassVar[tuple[int, ...]] = (20, 32, 36, 48, 52, 64, 80, 96, 120)

    # abstract
    AVATAR_TYPES: ClassVar[tuple[tuple[int, str], ...]]
    FILE_TYPE: ClassVar[str]

    file_id = BoundedBigIntegerField(unique=True, null=True)
    ident = models.CharField(max_length=32, unique=True, db_index=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self.ident:
            self.ident = uuid4().hex
        return super().save(*args, **kwargs)

    def get_file(self):
        # Favor control_file_id if it exists and is set.
        # Otherwise fallback to file_id. If still None, return.
        file_class = self.file_class()
        file_id = getattr(self, self.file_fk())
        if file_id is None:
            file_id = self.file_id
            file_class = File
            if file_id is None:
                return None
            copy_file_to_control_and_update_model.apply_async(
                kwargs={
                    "app_name": "sentry",
                    "model_name": type(self).__name__,
                    "model_id": self.id,
                    "file_id": file_id,
                }
            )

        try:
            return file_class.objects.get(pk=file_id)
        except ObjectDoesNotExist:
            # Best effort replication of previous behaviour with foreign key
            # which was set with on_delete=models.SET_NULL
            update = {self.file_fk(): None}
            self.update(**update)
            return None

    @property
    def get_file_id(self):
        return self.file_id

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

    @classmethod
    def file_class(cls):
        from sentry.models import File

        return File

    @classmethod
    def file_fk(cls) -> str:
        return "file_id"

    @classmethod
    def save_avatar(cls, relation, type, avatar=None, filename=None, color=None):
        if avatar:
            with atomic_transaction(using=router.db_for_write(cls.file_class())):
                photo = cls.file_class().objects.create(name=filename, type=cls.FILE_TYPE)
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
                setattr(instance, cls.file_fk(), photo.id)
                instance.ident = uuid4().hex

            instance.avatar_type = [i for i, n in cls.AVATAR_TYPES if n == type][0]

            instance.save()

        if photo and not created:
            instance.clear_cached_photos()

        return instance
