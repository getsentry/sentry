from django.db.models import Field

IGNORED_ATTRS = ["verbose_name", "help_text", "choices"]
original_deconstruct = Field.deconstruct


def deconstruct(self):
    """
    Overrides the default field deconstruct method. This is used to pop unwanted
    keyword arguments from the field during deconstruction, so that they will be ignored
    when generating migrations.
    """
    name, path, args, kwargs = original_deconstruct(self)
    for attr in IGNORED_ATTRS:
        kwargs.pop(attr, None)
    return name, path, args, kwargs
