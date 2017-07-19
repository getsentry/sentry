from __future__ import absolute_import, unicode_literals

import django

from debug_toolbar import settings as dt_settings


if dt_settings.PATCH_SETTINGS and django.VERSION[:2] < (1, 7):
    dt_settings.patch_all()
