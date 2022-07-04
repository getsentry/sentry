# This module used to implement encrypted fields.  These however were never really
# encrypted and the interface provided by them does not lend itself to useful
# encryption.  Since the main use of it was the `EncryptedPickledObjectField` in
# the codebase we want to phase out, this module only acts as a legacy shim at
# this point.

# New code should not use this module any more.  It will be removed in a future
# after migrations and models were changed to no longer reference it.


from django.db.models import CharField as EncryptedCharField
from django.db.models import TextField as EncryptedTextField

from django_picklefield import PickledObjectField as EncryptedPickledObjectField
from sentry.db.models.fields.jsonfield import JSONField as EncryptedJsonField

__all__ = (
    "EncryptedCharField",
    "EncryptedTextField",
    "EncryptedPickledObjectField",
    "EncryptedJsonField",
)
