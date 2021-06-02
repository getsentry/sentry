from django.db.models import Field

IGNORED_ATTRS = ["verbose_name", "help_text", "choices"]
original_deconstruct = Field.deconstruct


def deconstruct(self):
    name, path, args, kwargs = original_deconstruct(self)
    for attr in IGNORED_ATTRS:
        kwargs.pop(attr, None)
    return name, path, args, kwargs
