from io import BytesIO
from uuid import uuid4

from django.db import models, router
from django.utils.encoding import force_bytes
from PIL import Image

from sentry.db.models import BoundedBigIntegerField, Model
from sentry.utils.cache import cache
from sentry.utils.db import atomic_transaction


class AvatarBase(Model):
    """
    Base class for UserAvatar, OrganizationAvatar, TeamAvatar,
    and ProjectAvatar models. Associates those entities with their
    avatar preferences/files.
    """

    __include_in_export__ = False

    ALLOWED_SIZES = (20, 32, 36, 48, 52, 64, 80, 96, 120)

    FILE_TYPE = None

    file_id = BoundedBigIntegerField(unique=True, null=True)
    ident = models.CharField(max_length=32, unique=True, db_index=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self.ident:
            self.ident = uuid4().hex
        return super().save(*args, **kwargs)

    def get_file(self):
        from sentry.models import File

        if self.file_id is None:
            return None

        try:
            return File.objects.get(pk=self.file_id)
        except File.DoesNotExist:
            # Best effort replication of previous behaviour with foreign key
            # which was set with on_delete=models.SET_NULL
            self.update(file_id=None)
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

    @classmethod
    def save_avatar(cls, relation, type, avatar=None, filename=None):
        from sentry.models import File

        if avatar:
            with atomic_transaction(using=router.db_for_write(File)):
                photo = File.objects.create(name=filename, type=cls.FILE_TYPE)
                # XXX: Avatar may come in as a string instance in python2
                # if it's not wrapped in BytesIO.
                if isinstance(avatar, str):
                    avatar = BytesIO(force_bytes(avatar))
                photo.putfile(avatar)
        else:
            photo = None

        with atomic_transaction(
            using=(
                router.db_for_write(cls),
                router.db_for_write(File),
            )
        ):
            instance, created = cls.objects.get_or_create(**relation)
            file = instance.get_file()
            if file and photo:
                file.delete()

            if photo:
                instance.file_id = photo.id
                instance.ident = uuid4().hex

            instance.avatar_type = [i for i, n in cls.AVATAR_TYPES if n == type][0]

            instance.save()

        if photo and not created:
            instance.clear_cached_photos()

        return instance
