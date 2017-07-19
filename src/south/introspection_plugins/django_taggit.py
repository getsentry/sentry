"""
South introspection rules for django-taggit
"""

from django.conf import settings
from south.modelsinspector import add_ignored_fields

if 'taggit' in settings.INSTALLED_APPS:
    try:
        from taggit.managers import TaggableManager
    except ImportError:
        pass
    else:
        add_ignored_fields(["^taggit\.managers"])
