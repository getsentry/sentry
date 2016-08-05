from __future__ import absolute_import

import uuid

from django.db import models
from PIL import Image
from six import BytesIO

from sentry.db.models import FlexibleForeignKey, Model
from sentry.utils.cache import cache


class UserAvatar(Model):
    """
    A UserAvatar associates a User with their avatar photo File
    and contains their preferences for avatar type.
    """
    __core__ = False

    AVATAR_TYPES = (
        (0, 'letter_avatar'),
        (1, 'upload'),
        (2, 'gravatar'),
    )

    ALLOWED_SIZES = (20, 32, 48, 52, 64, 80, 96, 120)

    user = FlexibleForeignKey('sentry.User', unique=True, related_name='avatar')
    file = FlexibleForeignKey('sentry.File', unique=True, null=True, on_delete=models.SET_NULL)
    ident = models.CharField(max_length=32, unique=True, db_index=True)
    avatar_type = models.PositiveSmallIntegerField(default=0, choices=AVATAR_TYPES)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_useravatar'

    def save(self, *args, **kwargs):
        if not self.ident:
            self.ident = uuid.uuid4().hex
        return super(UserAvatar, self).save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.file:
            self.file.delete()
        return super(UserAvatar, self).delete(*args, **kwargs)

    def get_cache_key(self, size):
        return 'avatar:%s:%s' % (self.user_id, size)

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
                image = image.resize((size, size))
                image_file = BytesIO()
                image.save(image_file, 'PNG')
                photo = image_file.getvalue()
                cache.set(cache_key, photo)
        return photo
