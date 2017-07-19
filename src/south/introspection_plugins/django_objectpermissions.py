"""
South introspection rules for django-objectpermissions
"""

from django.conf import settings
from south.modelsinspector import add_ignored_fields

if 'objectpermissions' in settings.INSTALLED_APPS:
    try:
        from objectpermissions.models import UserPermissionRelation, GroupPermissionRelation
    except ImportError:
        pass
    else:
        add_ignored_fields(["^objectpermissions\.models\.UserPermissionRelation",
                            "^objectpermissions\.models\.GroupPermissionRelation"])

