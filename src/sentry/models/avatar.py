from __future__ import absolute_import

import six

from django.utils.encoding import force_bytes
from django.db import models, transaction
from PIL import Image
from six import BytesIO
from uuid import uuid4

from sentry.db.models import FlexibleForeignKey, Model
from sentry.utils.cache import cache


class AvatarBase(Model):
    """
    Base class for UserAvatar, OrganizationAvatar, TeamAvatar,
    and ProjectAvatar models. Associates those entities with their
    avatar preferences/files.
    """

    __core__ = False

    ALLOWED_SIZES = (20, 32, 36, 48, 52, 64, 80, 96, 120)

    FILE_TYPE = None

    file = FlexibleForeignKey("sentry.File", unique=True, null=True, on_delete=models.SET_NULL)
    ident = models.CharField(max_length=32, unique=True, db_index=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self.ident:
            self.ident = uuid4().hex
        return super(AvatarBase, self).save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.file:
            self.file.delete()
        return super(AvatarBase, self).delete(*args, **kwargs)

    def get_cache_key(self, size):
        raise NotImplementedError

    def clear_cached_photos(self):
        cache.delete_many([self.get_cache_key(x) for x in self.ALLOWED_SIZES])

    def get_cached_photo(self, size):
        if not self.file:
            return
        if size not in self.ALLOWED_SIZES:
            size = min(self.ALLOWED_SIZES, key=lambda x: abs(x - size))
        cache_key = self.get_cache_key(size)
        photo = cache.get(cache_key)
        if photo is None:
            photo_file = self.file.getfile()
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
            with transaction.atomic():
                photo = File.objects.create(name=filename, type=cls.FILE_TYPE)
                # XXX: Avatar may come in as a string instance in python2
                # if it's not wrapped in BytesIO.
                if isinstance(avatar, six.string_types):
                    avatar = BytesIO(force_bytes(avatar))
                photo.putfile(avatar)
        else:
            photo = None

        with transaction.atomic():
            instance, created = cls.objects.get_or_create(**relation)
            if instance.file and photo:
                instance.file.delete()

            if photo:
                instance.file = photo
                instance.ident = uuid4().hex

            instance.avatar_type = [i for i, n in cls.AVATAR_TYPES if n == type][0]

            instance.save()

        if photo and not created:
            instance.clear_cached_photos()

        return instance
