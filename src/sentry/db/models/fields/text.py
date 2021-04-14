"""
Traditional Django model fields, except their type is
explicitly `text` as opposed to `varchar`. All other
validations and behaviors are identical.

The reason this exists is because in Postgres, `text`
and `varchar` are nearly identical. The issue is when
picking a CharField and needing to size up the length
needing a database migration. Typically the database
validation isn't strictly required, so we can use
`text` type instead to only enforce the length in
python to allow us to size up the lengths without any
migrations.
"""


from django.db import models

__all__ = ("CharField", "EmailField")


class TextType:
    def db_type(self, connection):
        return "text"


class CharField(TextType, models.CharField):
    pass


class EmailField(TextType, models.EmailField):
    pass
