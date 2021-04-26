import logging
import pickle

from django.db.models import TextField

from sentry.db.models.utils import Creator
from sentry.utils.strings import compress, decompress

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
        super().contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))

    def to_python(self, value):
        if isinstance(value, str) and value:
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
        # enforce strings to guarantee consistency
        if isinstance(value, bytes):
            value = str(value)
        # db values need to be in unicode
        return compress(pickle.dumps(value))

    def value_to_string(self, obj):
        return self.get_prep_value(self.value_from_object(obj))
