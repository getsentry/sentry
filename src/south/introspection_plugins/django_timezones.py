from south.modelsinspector import add_introspection_rules
from django.conf import settings

if "timezones" in settings.INSTALLED_APPS:
    try:
        from timezones.fields import TimeZoneField
    except ImportError:
        pass
    else:
        rules = [
            (
                (TimeZoneField, ),
                [],
                {
                    "blank": ["blank", {"default": True}],
                    "max_length": ["max_length", {"default": 100}],
                },
            ),
        ]
        add_introspection_rules(rules, ["^timezones\.fields",])

