from __future__ import absolute_import, print_function

import logging
import six

from django.db.models import TextField

from sentry.db.models.utils import Creator
from sentry.utils.compat import pickle
from sentry.utils.strings import decompress, compress

__all__ = ("GzippedDictField",)

logger = logging.getLogger("sentry")


class GzippedDictField(TextField):
    """
    Slightly different from a JSONField in the sense that the default
    value is a dictionary.
    """

    def contribute_to_class(self, cls, name):
        """
        Add a descriptor for backwards compatibility
        with previous Django behavior.
        """
        super(GzippedDictField, self).contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))

    def to_python(self, value):
        if isinstance(value, six.string_types) and value:
            try:
                value = pickle.loads(decompress(value))
            except Exception as e:
                logger.exception(e)
                return {}
        elif not value:
            return {}
        return value

    def get_prep_value(self, value):
        if not value and self.null:
            # save ourselves some storage
            return None
        # enforce six.text_type strings to guarantee consistency
        if isinstance(value, six.binary_type):
            value = six.text_type(value)
        # db values need to be in unicode
        return compress(pickle.dumps(value))

    def value_to_string(self, obj):
        value = self._get_val_from_obj(obj)
        return self.get_prep_value(value)
