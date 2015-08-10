from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser as BaseAnonymousUser


class AnonymousUser(BaseAnonymousUser):
    def is_active_superuser(self):
        return False
