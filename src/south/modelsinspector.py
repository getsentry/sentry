"""
Like the old south.modelsparser, but using introspection where possible
rather than direct inspection of models.py.
"""

from __future__ import print_function

import datetime
import re
import decimal

from south.utils import get_attribute, auto_through
from south.utils.py3 import text_type

from django.db import models
from django.db.models.base import ModelBase, Model
from django.db.models.fields import NOT_PROVIDED
from django.conf import settings
from django.utils.functional import Promise
from django.contrib.contenttypes import generic
from django.utils.datastructures import SortedDict
from django.utils import datetime_safe

NOISY = False

try:
    from django.utils import timezone
except ImportError:
    timezone = False


# Define any converter functions first to prevent NameErrors

def convert_on_delete_handler(value):
    django_db_models_module = 'models'  # relative to standard import 'django.db'
    if hasattr(models, "PROTECT"):
        if value in (models.CASCADE, models.PROTECT, models.DO_NOTHING, models.SET_DEFAULT):
            # straightforward functions
            return '%s.%s' % (django_db_models_module, value.__name__)
        else:
            # This is totally dependent on the implementation of django.db.models.deletion.SET
            func_name = getattr(value, '__name__', None)
            if func_name == 'set_on_delete':
                # we must inspect the function closure to see what parameters were passed in
                closure_contents = value.__closure__[0].cell_contents
                if closure_contents is None:
                    return "%s.SET_NULL" % (django_db_models_module)
                # simple function we can perhaps cope with:
                elif hasattr(closure_contents, '__call__'):
                    raise ValueError("South does not support on_delete with SET(function) as values.")
                else:
                    # Attempt to serialise the value
                    return "%s.SET(%s)" % (django_db_models_module, value_clean(closure_contents))
        raise ValueError("%s was not recognized as a valid model deletion handler. Possible values: %s." % (value, ', '.join(f.__name__ for f in (models.CASCADE, models.PROTECT, models.SET, models.SET_NULL, models.SET_DEFAULT, models.DO_NOTHING))))
    else:
        raise ValueError("on_delete argument encountered in Django version that does not support it")

# Gives information about how to introspect certain fields.
# This is a list of triples; the first item is a list of fields it applies to,
# (note that isinstance is used, so superclasses are perfectly valid here)
# the second is a list of positional argument descriptors, and the third
# is a list of keyword argument descriptors.
# Descriptors are of the form:
#  [attrname, options]
# Where attrname is the attribute on the field to get the value from, and options
# is an optional dict.
#
# The introspector uses the combination of all matching entries, in order.
                                     
introspection_details = [
    (
        (models.Field, ),
        [],
        {
            "null": ["null", {"default": False}],
            "blank": ["blank", {"default": False, "ignore_if":"primary_key"}],
            "primary_key": ["primary_key", {"default": False}],
            "max_length": ["max_length", {"default": None}],
            "unique": ["_unique", {"default": False}],
            "db_index": ["db_index", {"default": False}],
            "default": ["default", {"default": NOT_PROVIDED, "ignore_dynamics": True}],
            "db_column": ["db_column", {"default": None}],
            "db_tablespace": ["db_tablespace", {"default": settings.DEFAULT_INDEX_TABLESPACE}],
        },
    ),
    (
        (models.ForeignKey, models.OneToOneField),
        [],
        dict([
            ("to", ["rel.to", {}]),
            ("to_field", ["rel.field_name", {"default_attr": "rel.to._meta.pk.name"}]),
            ("related_name", ["rel.related_name", {"default": None}]),
            ("db_index", ["db_index", {"default": True}]),
            ("on_delete", ["rel.on_delete", {"default": getattr(models, "CASCADE", None), "is_django_function": True, "converter": convert_on_delete_handler, "ignore_missing": True}])
        ])
    ),
    (
        (models.ManyToManyField,),
        [],
        {
            "to": ["rel.to", {}],
            "symmetrical": ["rel.symmetrical", {"default": True}],
            "related_name": ["rel.related_name", {"default": None}],
            "db_table": ["db_table", {"default": None}],
            # TODO: Kind of ugly to add this one-time-only option
            "through": ["rel.through", {"ignore_if_auto_through": True}],
        },
    ),
    (
        (models.DateField, models.TimeField),
        [],
        {
            "auto_now": ["auto_now", {"default": False}],
            "auto_now_add": ["auto_now_add", {"default": False}],
        },
    ),
    (
        (models.DecimalField, ),
        [],
        {
            "max_digits": ["max_digits", {"default": None}],
            "decimal_places": ["decimal_places", {"default": None}],
        },
    ),
    (
        (models.SlugField, ),
        [],
        {
            "db_index": ["db_index", {"default": True}],
        },
    ),
    (
        (models.BooleanField, ),
        [],
        {
            "default": ["default", {"default": NOT_PROVIDED, "converter": bool}],
            "blank": ["blank", {"default": True, "ignore_if":"primary_key"}],
        },
    ),
    (
        (models.FilePathField, ),
        [],
        {
            "path": ["path", {"default": ''}],
            "match": ["match", {"default": None}],
            "recursive": ["recursive", {"default": False}],
        },
    ),
    (
        (generic.GenericRelation, ),
        [],
        {
            "to": ["rel.to", {}],
            "symmetrical": ["rel.symmetrical", {"default": True}],
            "object_id_field": ["object_id_field_name", {"default": "object_id"}],
            "content_type_field": ["content_type_field_name", {"default": "content_type"}],
            "blank": ["blank", {"default": True}],
        },
    ),
]

# Regexes of allowed field full paths
allowed_fields = [
    "^django\.db",
    "^django\.contrib\.contenttypes\.generic",
    "^django\.contrib\.localflavor",
    "^django_localflavor_\w\w",
]

# Regexes of ignored fields (custom fields which look like fields, but have no column behind them)
ignored_fields = [
    "^django\.contrib\.contenttypes\.generic\.GenericRelation",
    "^django\.contrib\.contenttypes\.generic\.GenericForeignKey",
]

# Similar, but for Meta, so just the inner level (kwds).
meta_details = {
    "db_table": ["db_table", {"default_attr_concat": ["%s_%s", "app_label", "module_name"]}],
    "db_tablespace": ["db_tablespace", {"default": settings.DEFAULT_TABLESPACE}],
    "unique_together": ["unique_together", {"default": []}],
    "index_together": ["index_together", {"default": [], "ignore_missing": True}],
    "ordering": ["ordering", {"default": []}],
    "proxy": ["proxy", {"default": False, "ignore_missing": True}],
}


def add_introspection_rules(rules=[], patterns=[]):
    "Allows you to add some introspection rules at runtime, e.g. for 3rd party apps."
    assert isinstance(rules, (list, tuple))
    assert isinstance(patterns, (list, tuple))
    allowed_fields.extend(patterns)
    introspection_details.extend(rules)


def add_ignored_fields(patterns):
    "Allows you to add some ignore field patterns."
    assert isinstance(patterns, (list, tuple))
    ignored_fields.extend(patterns)
    

def can_ignore(field):
    """
    Returns True if we know for certain that we can ignore this field, False
    otherwise.
    """
    full_name = "%s.%s" % (field.__class__.__module__, field.__class__.__name__)
    for regex in ignored_fields:
        if re.match(regex, full_name):
            return True
    return False


def can_introspect(field):
    """
    Returns True if we are allowed to introspect this field, False otherwise.
    ('allowed' means 'in core'. Custom fields can declare they are introspectable
    by the default South rules by adding the attribute _south_introspects = True.)
    """
    # Check for special attribute
    if hasattr(field, "_south_introspects") and field._south_introspects:
        return True
    # Check it's an introspectable field
    full_name = "%s.%s" % (field.__class__.__module__, field.__class__.__name__)
    for regex in allowed_fields:
        if re.match(regex, full_name):
            return True
    return False


def matching_details(field):
    """
    Returns the union of all matching entries in introspection_details for the field.
    """
    our_args = []
    our_kwargs = {}
    for classes, args, kwargs in introspection_details:
        if any([isinstance(field, x) for x in classes]):
            our_args.extend(args)
            our_kwargs.update(kwargs)
    return our_args, our_kwargs


class IsDefault(Exception):
    """
    Exception for when a field contains its default value.
    """


def get_value(field, descriptor):
    """
    Gets an attribute value from a Field instance and formats it.
    """
    attrname, options = descriptor
    # If the options say it's not a attribute name but a real value, use that.
    if options.get('is_value', False):
        value = attrname
    else:
        try:
            value = get_attribute(field, attrname)
        except AttributeError:
            if options.get("ignore_missing", False):
                raise IsDefault
            else:
                raise
            
    # Lazy-eval functions get eval'd.
    if isinstance(value, Promise):
        value = text_type(value)
    # If the value is the same as the default, omit it for clarity
    if "default" in options and value == options['default']:
        raise IsDefault
    # If there's an ignore_if, use it
    if "ignore_if" in options:
        if get_attribute(field, options['ignore_if']):
            raise IsDefault
    # If there's an ignore_if_auto_through which is True, use it
    if options.get("ignore_if_auto_through", False):
        if auto_through(field):
            raise IsDefault
    # Some default values need to be gotten from an attribute too.
    if "default_attr" in options:
        default_value = get_attribute(field, options['default_attr'])
        if value == default_value:
            raise IsDefault
    # Some are made from a formatting string and several attrs (e.g. db_table)
    if "default_attr_concat" in options:
        format, attrs = options['default_attr_concat'][0], options['default_attr_concat'][1:]
        default_value = format % tuple(map(lambda x: get_attribute(field, x), attrs))
        if value == default_value:
            raise IsDefault
    # Clean and return the value
    return value_clean(value, options)


def value_clean(value, options={}):
    "Takes a value and cleans it up (so e.g. it has timezone working right)"
    # Lazy-eval functions get eval'd.
    if isinstance(value, Promise):
        value = text_type(value)
    # Callables get called.
    if not options.get('is_django_function', False) and callable(value) and not isinstance(value, ModelBase):
        # Datetime.datetime.now is special, as we can access it from the eval
        # context (and because it changes all the time; people will file bugs otherwise).
        if value == datetime.datetime.now:
            return "datetime.datetime.now"
        elif value == datetime.datetime.utcnow:
            return "datetime.datetime.utcnow"
        elif value == datetime.date.today:
            return "datetime.date.today"
        # In case we use Django's own now function, revert to datetime's
        # original one since we'll deal with timezones on our own.
        elif timezone and value == timezone.now:
            return "datetime.datetime.now"
        # All other callables get called.
        value = value()
    # Models get their own special repr()
    if isinstance(value, ModelBase):
        # If it's a proxy model, follow it back to its non-proxy parent
        if getattr(value._meta, "proxy", False):
            value = value._meta.proxy_for_model
        return "orm['%s.%s']" % (value._meta.app_label, value._meta.object_name)
    # As do model instances
    if isinstance(value, Model):
        if options.get("ignore_dynamics", False):
            raise IsDefault
        return "orm['%s.%s'].objects.get(pk=%r)" % (value.__class__._meta.app_label, value.__class__._meta.object_name, value.pk)
    # Make sure Decimal is converted down into a string
    if isinstance(value, decimal.Decimal):
        value = str(value)
    # in case the value is timezone aware
    datetime_types = (
        datetime.datetime,
        datetime.time,
        datetime_safe.datetime,
    )
    if (timezone and isinstance(value, datetime_types) and
            getattr(settings, 'USE_TZ', False) and
            value is not None and timezone.is_aware(value)):
        default_timezone = timezone.get_default_timezone()
        value = timezone.make_naive(value, default_timezone)
    # datetime_safe has an improper repr value
    if isinstance(value, datetime_safe.datetime):
        value = datetime.datetime(*value.utctimetuple()[:7])
    # converting a date value to a datetime to be able to handle
    # timezones later gracefully
    elif isinstance(value, (datetime.date, datetime_safe.date)):
        value = datetime.datetime(*value.timetuple()[:3])
    # Now, apply the converter func if there is one
    if "converter" in options:
        value = options['converter'](value)
    # Return the final value
    if options.get('is_django_function', False):
        return value
    else:
        return repr(value)


def introspector(field):
    """
    Given a field, introspects its definition triple.
    """
    arg_defs, kwarg_defs = matching_details(field)
    args = []
    kwargs = {}
    # For each argument, use the descriptor to get the real value.
    for defn in arg_defs:
        try:
            args.append(get_value(field, defn))
        except IsDefault:
            pass
    for kwd, defn in kwarg_defs.items():
        try:
            kwargs[kwd] = get_value(field, defn)
        except IsDefault:
            pass
    return args, kwargs


def get_model_fields(model, m2m=False):
    """
    Given a model class, returns a dict of {field_name: field_triple} defs.
    """
    
    field_defs = SortedDict()
    inherited_fields = {}
    
    # Go through all bases (that are themselves models, but not Model)
    for base in model.__bases__:
        if hasattr(base, '_meta') and issubclass(base, models.Model):
            if not base._meta.abstract:
                # Looks like we need their fields, Ma.
                inherited_fields.update(get_model_fields(base))
    
    # Now, go through all the fields and try to get their definition
    source = model._meta.local_fields[:]
    if m2m:
        source += model._meta.local_many_to_many
    
    for field in source:
        # Can we ignore it completely?
        if can_ignore(field):
            continue
        # Does it define a south_field_triple method?
        if hasattr(field, "south_field_triple"):
            if NOISY:
                print(" ( Nativing field: %s" % field.name)
            field_defs[field.name] = field.south_field_triple()
        # Can we introspect it?
        elif can_introspect(field):
            # Get the full field class path.
            field_class = field.__class__.__module__ + "." + field.__class__.__name__
            # Run this field through the introspector
            args, kwargs = introspector(field)
            # Workaround for Django bug #13987
            if model._meta.pk.column == field.column and 'primary_key' not in kwargs:
                kwargs['primary_key'] = True
            # That's our definition!
            field_defs[field.name] = (field_class, args, kwargs)
        # Shucks, no definition!
        else:
            if NOISY:
                print(" ( Nodefing field: %s" % field.name)
            field_defs[field.name] = None
    
    # If they've used the horrific hack that is order_with_respect_to, deal with
    # it.
    if model._meta.order_with_respect_to:
        field_defs['_order'] = ("django.db.models.fields.IntegerField", [], {"default": "0"})
    
    return field_defs


def get_model_meta(model):
    """
    Given a model class, will return the dict representing the Meta class.
    """
    
    # Get the introspected attributes
    meta_def = {}
    for kwd, defn in meta_details.items():
        try:
            meta_def[kwd] = get_value(model._meta, defn)
        except IsDefault:
            pass
    
    # Also, add on any non-abstract model base classes.
    # This is called _ormbases as the _bases variable was previously used
    # for a list of full class paths to bases, so we can't conflict.
    for base in model.__bases__:
        if hasattr(base, '_meta') and issubclass(base, models.Model):
            if not base._meta.abstract:
                # OK, that matches our terms.
                if "_ormbases" not in meta_def:
                    meta_def['_ormbases'] = []
                meta_def['_ormbases'].append("%s.%s" % (
                    base._meta.app_label,
                    base._meta.object_name,
                ))
    
    return meta_def


# Now, load the built-in South introspection plugins
import south.introspection_plugins
