from __future__ import absolute_import

from django.db import models
from django.db.models import OneToOneField

__all__ = ("OneToOneCascadeDeletes",)


class OneToOneCascadeDeletes(OneToOneField):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("on_delete", models.CASCADE)
        return super(OneToOneCascadeDeletes, self).__init__(*args, **kwargs)
