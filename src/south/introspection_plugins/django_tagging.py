from south.modelsinspector import add_introspection_rules
from django.conf import settings

if "tagging" in settings.INSTALLED_APPS:
    try:
        from tagging.fields import TagField
    except ImportError:
        pass
    else:
        rules = [
            (
                (TagField, ),
                [],
                {
                    "blank": ["blank", {"default": True}],
                    "max_length": ["max_length", {"default": 255}],
                },
            ),
        ]
        add_introspection_rules(rules, ["^tagging\.fields",])

if "tagging_autocomplete" in settings.INSTALLED_APPS:
    add_introspection_rules([], ["^tagging_autocomplete\.models\.TagAutocompleteField"])

