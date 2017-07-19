from django.conf import settings
from south.modelsinspector import add_introspection_rules

if 'annoying' in settings.INSTALLED_APPS:
    try:
        from annoying.fields import AutoOneToOneField
    except ImportError:
        pass
    else:
        #django-annoying's AutoOneToOneField is essentially a OneToOneField.
        add_introspection_rules([], ["^annoying\.fields\.AutoOneToOneField"])
