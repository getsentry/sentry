"""
Handles freezing of models into FakeORMs.
"""

from __future__ import print_function

import sys

from django.db import models
from django.db.models.base import ModelBase, Model
from django.contrib.contenttypes.generic import GenericRelation

from south.utils import get_attribute, auto_through
from south import modelsinspector
from south.utils.py3 import string_types

def freeze_apps(apps):
    """
    Takes a list of app labels, and returns a string of their frozen form.
    """
    if isinstance(apps, string_types):
        apps = [apps]
    frozen_models = set()
    # For each app, add in all its models
    for app in apps:
        for model in models.get_models(models.get_app(app)):
            # Only add if it's not abstract or proxy
            if not model._meta.abstract and not getattr(model._meta, "proxy", False):
                frozen_models.add(model)
    # Now, add all the dependencies
    for model in list(frozen_models):
        frozen_models.update(model_dependencies(model))
    # Serialise!
    model_defs = {}
    model_classes = {}
    for model in frozen_models:
        model_defs[model_key(model)] = prep_for_freeze(model)
        model_classes[model_key(model)] = model
    # Check for any custom fields that failed to freeze.
    missing_fields = False
    for key, fields in model_defs.items():
        for field_name, value in fields.items():
            if value is None:
                missing_fields = True
                model_class = model_classes[key]
                field_class = model_class._meta.get_field_by_name(field_name)[0]
                print(" ! Cannot freeze field '%s.%s'" % (key, field_name))
                print(" ! (this field has class %s.%s)" % (field_class.__class__.__module__, field_class.__class__.__name__))
    if missing_fields:
        print("")
        print(" ! South cannot introspect some fields; this is probably because they are custom")
        print(" ! fields. If they worked in 0.6 or below, this is because we have removed the")
        print(" ! models parser (it often broke things).")
        print(" ! To fix this, read http://south.aeracode.org/wiki/MyFieldsDontWork")
        sys.exit(1)
    
    return model_defs
    
def freeze_apps_to_string(apps):
    return pprint_frozen_models(freeze_apps(apps))
    
### 

def model_key(model):
    "For a given model, return 'appname.modelname'."
    return "%s.%s" % (model._meta.app_label, model._meta.object_name.lower())

def prep_for_freeze(model):
    """
    Takes a model and returns the ready-to-serialise dict (all you need
    to do is just pretty-print it).
    """
    fields = modelsinspector.get_model_fields(model, m2m=True)
    # Remove useless attributes (like 'choices')
    for name, field in fields.items():
        fields[name] = remove_useless_attributes(field)
    # See if there's a Meta
    fields['Meta'] = remove_useless_meta(modelsinspector.get_model_meta(model))
    # Add in our own special items to track the object name and managed
    fields['Meta']['object_name'] = model._meta.object_name # Special: not eval'able.
    if not getattr(model._meta, "managed", True):
        fields['Meta']['managed'] = repr(model._meta.managed)
    return fields

### Dependency resolvers

def model_dependencies(model, checked_models=None):
    """
    Returns a set of models this one depends on to be defined; things like
    OneToOneFields as ID, ForeignKeys everywhere, etc.
    """
    depends = set()
    checked_models = checked_models or set()
    # Get deps for each field
    for field in model._meta.fields + model._meta.many_to_many:
        depends.update(field_dependencies(field, checked_models))
    # Add in any non-abstract bases
    for base in model.__bases__:
        if issubclass(base, models.Model) and hasattr(base, '_meta') and not base._meta.abstract:
            depends.add(base)
    # Now recurse
    new_to_check = depends - checked_models
    while new_to_check:
        checked_model = new_to_check.pop()
        if checked_model == model or checked_model in checked_models:
            continue
        checked_models.add(checked_model)
        deps = model_dependencies(checked_model, checked_models)
        # Loop through dependencies...
        for dep in deps:
            # If the new dep is not already checked, add to the queue
            if (dep not in depends) and (dep not in new_to_check) and (dep not in checked_models):
                new_to_check.add(dep)
            depends.add(dep)
    return depends

def field_dependencies(field, checked_models=None):
    checked_models = checked_models or set()
    depends = set()
    arg_defs, kwarg_defs = modelsinspector.matching_details(field)
    for attrname, options in arg_defs + list(kwarg_defs.values()):
        if options.get("ignore_if_auto_through", False) and auto_through(field):
            continue
        if options.get("is_value", False):
            value = attrname
        elif attrname == 'rel.through' and hasattr(getattr(field, 'rel', None), 'through_model'):
            # Hack for django 1.1 and below, where the through model is stored
            # in rel.through_model while rel.through stores only the model name.
            value = field.rel.through_model
        else:
            try:
                value = get_attribute(field, attrname)
            except AttributeError:
                if options.get("ignore_missing", False):
                    continue
                raise
        if isinstance(value, Model):
            value = value.__class__
        if not isinstance(value, ModelBase):
            continue
        if getattr(value._meta, "proxy", False):
            value = value._meta.proxy_for_model
        if value in checked_models:
            continue
        checked_models.add(value)
        depends.add(value)
        depends.update(model_dependencies(value, checked_models))

    return depends

### Prettyprinters

def pprint_frozen_models(models):
    return "{\n        %s\n    }" % ",\n        ".join([
        "%r: %s" % (name, pprint_fields(fields))
        for name, fields in sorted(models.items())
    ])

def pprint_fields(fields):
    return "{\n            %s\n        }" % ",\n            ".join([
        "%r: %r" % (name, defn)
        for name, defn in sorted(fields.items())
    ])

### Output sanitisers

USELESS_KEYWORDS = ["choices", "help_text", "verbose_name"]
USELESS_DB_KEYWORDS = ["related_name", "default", "blank"] # Important for ORM, not for DB.
INDEX_KEYWORDS = ["db_index"]

def remove_useless_attributes(field, db=False, indexes=False):
    "Removes useless (for database) attributes from the field's defn."
    # Work out what to remove, and remove it.
    keywords = USELESS_KEYWORDS[:]
    if db:
        keywords += USELESS_DB_KEYWORDS[:]
    if indexes:
        keywords += INDEX_KEYWORDS[:]
    if field:
        for name in keywords:
            if name in field[2]:
                del field[2][name]
    return field

USELESS_META = ["verbose_name", "verbose_name_plural"]
def remove_useless_meta(meta):
    "Removes useless (for database) attributes from the table's meta."
    if meta:
        for name in USELESS_META:
            if name in meta:
                del meta[name]
    return meta
