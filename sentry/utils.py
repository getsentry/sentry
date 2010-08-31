from django.db import models

import base64
try:
    import cPickle as pickle
except ImportError:
    import pickle

def transform(value):
    if isinstance(value, (tuple, list)):
        return [transform(o) for o in value]
    elif isinstance(value, dict):
        return dict((k, transform(v)) for k, v in value.iteritems())
    elif not isinstance(value, (int, bool, basestring)) and value is not None:
        return unicode(value)
    return value

class GzippedDictField(models.TextField):
    """
    Slightly different from a JSONField in the sense that the default
    value is a dictionary.
    """
    __metaclass__ = models.SubfieldBase
 
    def to_python(self, value):
        if isinstance(value, basestring) and value:
            value = pickle.loads(base64.b64decode(value).decode('zlib'))
        elif not value:
            return {}
        return value

    def get_prep_value(self, value):
        if value is None: return
        return base64.b64encode(pickle.dumps(transform(value)).encode('zlib'))
 
    def value_to_string(self, obj):
        value = self._get_val_from_obj(obj)
        return self.get_db_prep_value(value)

    def south_field_triple(self):
        "Returns a suitable description of this field for South."
        from south.modelsinspector import introspector
        field_class = "django.db.models.fields.TextField"
        args, kwargs = introspector(self)
        return (field_class, args, kwargs)