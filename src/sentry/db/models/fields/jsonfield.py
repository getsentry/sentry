from __future__ import absolute_import, unicode_literals
import json
import datetime
import six

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.conf import settings
from django.db import models, DatabaseError, transaction
from django.utils.translation import ugettext_lazy as _
from django.core.cache import cache

__version__ = '0.9.13'

DB_TYPE_CACHE_KEY = (
    'django-jsonfield:db-type:%s' % __version__ +
    '%(ENGINE)s:%(HOST)s:%(PORT)s:%(NAME)s'
)


def default(o):
    if hasattr(o, 'to_json'):
        return o.to_json()
    if isinstance(o, Decimal):
        return six.text_type(o)
    if isinstance(o, datetime.datetime):
        if o.tzinfo:
            return o.strftime('%Y-%m-%dT%H:%M:%S%z')
        return o.strftime("%Y-%m-%dT%H:%M:%S")
    if isinstance(o, datetime.date):
        return o.strftime("%Y-%m-%d")
    if isinstance(o, datetime.time):
        if o.tzinfo:
            return o.strftime('%H:%M:%S%z')
        return o.strftime("%H:%M:%S")

    raise TypeError(repr(o) + " is not JSON serializable")


class JSONField(six.with_metaclass(models.SubfieldBase, models.Field)):
    """
    A field that will ensure the data entered into it is valid JSON.
    """
    default_error_messages = {
        'invalid': _("'%s' is not a valid JSON string.")
    }
    description = "JSON object"

    def __init__(self, *args, **kwargs):
        if not kwargs.get('null', False):
            kwargs['default'] = kwargs.get('default', dict)
        self.encoder_kwargs = {
            'indent': kwargs.pop('indent', getattr(settings, 'JSONFIELD_INDENT', None))
        }
        super(JSONField, self).__init__(*args, **kwargs)
        self.validate(self.get_default(), None)

    def validate(self, value, model_instance):
        if not self.null and value is None:
            raise ValidationError(self.error_messages['null'])
        try:
            self.get_prep_value(value)
        except BaseException:
            raise ValidationError(self.error_messages['invalid'] % value)

    def get_default(self):
        if self.has_default():
            default = self.default
            if callable(default):
                default = default()
            if isinstance(default, six.string_types):
                return json.loads(default)
            return json.loads(json.dumps(default))
        return super(JSONField, self).get_default()

    def get_internal_type(self):
        return 'TextField'

    def db_type(self, connection):
        cache_key = DB_TYPE_CACHE_KEY % connection.settings_dict
        db_type = cache.get(cache_key)

        if not db_type:
            # Test to see if we support JSON querying.
            cursor = connection.cursor()
            try:
                sid = transaction.savepoint(using=connection.alias)
                cursor.execute('SELECT \'{}\'::json = \'{}\'::json;')
            except DatabaseError:
                transaction.savepoint_rollback(sid, using=connection.alias)
                db_type = 'text'
            else:
                db_type = 'json'
            cache.set(cache_key, db_type)

        return db_type

    def to_python(self, value):
        if isinstance(value, six.string_types):
            if value == "":
                if self.null:
                    return None
                if self.blank:
                    return ""
            try:
                value = json.loads(value)
            except ValueError:
                msg = self.error_messages['invalid'] % value
                raise ValidationError(msg)
        # TODO: Look for date/time/datetime objects within the structure?
        return value

    def get_db_prep_value(self, value, connection=None, prepared=None):
        return self.get_prep_value(value)

    def get_prep_value(self, value):
        if value is None:
            if not self.null and self.blank:
                return ""
            return None
        return json.dumps(value, default=default, **self.encoder_kwargs)

    def get_prep_lookup(self, lookup_type, value):
        if lookup_type in ["exact", "iexact"]:
            return self.to_python(self.get_prep_value(value))
        if lookup_type == "in":
            return [self.to_python(self.get_prep_value(v)) for v in value]
        if lookup_type == "isnull":
            return value
        if lookup_type in ["contains", "icontains"]:
            if isinstance(value, (list, tuple)):
                raise TypeError("Lookup type %r not supported with argument of %s" % (
                    lookup_type, type(value).__name__
                ))
                # Need a way co combine the values with '%', but don't escape that.
                return self.get_prep_value(value)[1:-1].replace(', ', r'%')
            if isinstance(value, dict):
                return self.get_prep_value(value)[1:-1]
            return self.to_python(self.get_prep_value(value))
        raise TypeError('Lookup type %r not supported' % lookup_type)

    def value_to_string(self, obj):
        return self._get_val_from_obj(obj)


class TypedJSONField(JSONField):
    """

    """

    def __init__(self, *args, **kwargs):
        self.json_required_fields = kwargs.pop('required_fields', {})
        self.json_validators = kwargs.pop('validators', [])

        super(TypedJSONField, self).__init__(*args, **kwargs)

    def cast_required_fields(self, obj):
        if not obj:
            return
        for field_name, field_type in self.json_required_fields.items():
            obj[field_name] = field_type.to_python(obj[field_name])

    def to_python(self, value):
        value = super(TypedJSONField, self).to_python(value)

        if isinstance(value, list):
            for item in value:
                self.cast_required_fields(item)
        else:
            self.cast_required_fields(value)

        return value

    def validate(self, value, model_instance):
        super(TypedJSONField, self).validate(value, model_instance)

        for v in self.json_validators:
            if isinstance(value, list):
                for item in value:
                    v(item)
            else:
                v(value)


if 'south' in settings.INSTALLED_APPS:
    from south.modelsinspector import add_introspection_rules
    add_introspection_rules([], ['^jsonfield\.fields\.JSONField'])
    add_introspection_rules([], ['^jsonfield\.fields\.TypedJSONField'])
