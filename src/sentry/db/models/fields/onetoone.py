from django.db import models
from django.db.models import OneToOneField

__all__ = ("OneToOneCascadeDeletes",)


class OneToOneCascadeDeletes(OneToOneField):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("on_delete", models.CASCADE)
        return super().__init__(*args, **kwargs)
