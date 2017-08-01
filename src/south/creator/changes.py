"""
Contains things to detect changes - either using options passed in on the
commandline, or by using autodetection, etc.
"""

from __future__ import print_function

from django.db import models
from django.contrib.contenttypes.generic import GenericRelation
from django.utils.datastructures import SortedDict

from south.creator.freezer import remove_useless_attributes, freeze_apps, model_key
from south.utils import auto_through
from south.utils.py3 import string_types

class BaseChanges(object):
    """
    Base changes class.
    """
    def suggest_name(self):
        return ''
    
    def split_model_def(self, model, model_def):
        """
        Given a model and its model def (a dict of field: triple), returns three
        items: the real fields dict, the Meta dict, and the M2M fields dict.
        """
        real_fields = SortedDict()
        meta = SortedDict()
        m2m_fields = SortedDict()
        for name, triple in model_def.items():
            if name == "Meta":
                meta = triple
            elif isinstance(model._meta.get_field_by_name(name)[0], models.ManyToManyField):
                m2m_fields[name] = triple
            else:
                real_fields[name] = triple
        return real_fields, meta, m2m_fields
    
    def current_model_from_key(self, key):
        app_label, model_name = key.split(".")
        return models.get_model(app_label, model_name)
    
    def current_field_from_key(self, key, fieldname):
        app_label, model_name = key.split(".")
        # Special, for the magical field from order_with_respect_to
        if fieldname == "_order":
            field = models.IntegerField()
            field.name = "_order"
            field.attname = "_order"
            field.column = "_order"
            field.default = 0
            return field
        # Otherwise, normal.
        return models.get_model(app_label, model_name)._meta.get_field_by_name(fieldname)[0]


class AutoChanges(BaseChanges):
    """
    Detects changes by 'diffing' two sets of frozen model definitions.
    """
    
    # Field types we don't generate add/remove field changes for.
    IGNORED_FIELD_TYPES = [
        GenericRelation,
    ]
    
    def __init__(self, migrations, old_defs, old_orm, new_defs):
        self.migrations = migrations
        self.old_defs = old_defs
        self.old_orm = old_orm
        self.new_defs = new_defs
    
    def suggest_name(self):
        parts = ["auto"]
        for change_name, params in self.get_changes():
            if change_name == "AddModel":
                parts.append("add_%s" % params['model']._meta.object_name.lower())
            elif change_name == "DeleteModel":
                parts.append("del_%s" % params['model']._meta.object_name.lower())
            elif change_name == "AddField":
                parts.append("add_field_%s_%s" % (
                    params['model']._meta.object_name.lower(),
                    params['field'].name,
                ))
            elif change_name == "DeleteField":
                parts.append("del_field_%s_%s" % (
                    params['model']._meta.object_name.lower(),
                    params['field'].name,
                ))
            elif change_name == "ChangeField":
                parts.append("chg_field_%s_%s" % (
                    params['model']._meta.object_name.lower(),
                    params['new_field'].name,
                ))
            elif change_name == "AddUnique":
                parts.append("add_unique_%s_%s" % (
                    params['model']._meta.object_name.lower(),
                    "_".join([x.name for x in params['fields']]),
                ))
            elif change_name == "DeleteUnique":
                parts.append("del_unique_%s_%s" % (
                    params['model']._meta.object_name.lower(),
                    "_".join([x.name for x in params['fields']]),
                ))
            elif change_name == "AddIndex":
                parts.append("add_index_%s_%s" % (
                    params['model']._meta.object_name.lower(),
                    "_".join([x.name for x in params['fields']]),
                ))
            elif change_name == "DeleteIndex":
                parts.append("del_index_%s_%s" % (
                    params['model']._meta.object_name.lower(),
                    "_".join([x.name for x in params['fields']]),
                ))
        return ("__".join(parts))[:70]
    
    def get_changes(self):
        """
        Returns the difference between the old and new sets of models as a 5-tuple:
        added_models, deleted_models, added_fields, deleted_fields, changed_fields
        """
        
        deleted_models = set()
        
        # See if anything's vanished
        for key in self.old_defs:
            if key not in self.new_defs:
                # We shouldn't delete it if it was managed=False
                old_fields, old_meta, old_m2ms = self.split_model_def(self.old_orm[key], self.old_defs[key])
                if old_meta.get("managed", "True") != "False":
                    # Alright, delete it.
                    yield ("DeleteModel", {
                        "model": self.old_orm[key], 
                        "model_def": old_fields,
                    })
                    # Also make sure we delete any M2Ms it had.
                    for fieldname in old_m2ms:
                        # Only delete its stuff if it wasn't a through=.
                        field = self.old_orm[key + ":" + fieldname]
                        if auto_through(field):
                            yield ("DeleteM2M", {"model": self.old_orm[key], "field": field})
                    # And any index/uniqueness constraints it had
                    for attr, operation in (("unique_together", "DeleteUnique"), ("index_together", "DeleteIndex")):
                        together = eval(old_meta.get(attr, "[]"))
                        if together:
                            # If it's only a single tuple, make it into the longer one
                            if isinstance(together[0], string_types):
                                together = [together]
                            # For each combination, make an action for it
                            for fields in together:
                                yield (operation, {
                                    "model": self.old_orm[key],
                                    "fields": [self.old_orm[key]._meta.get_field_by_name(x)[0] for x in fields],
                                })
                # We always add it in here so we ignore it later
                deleted_models.add(key)
        
        # Or appeared
        for key in self.new_defs:
            if key not in self.old_defs:
                # We shouldn't add it if it's managed=False
                new_fields, new_meta, new_m2ms = self.split_model_def(self.current_model_from_key(key), self.new_defs[key])
                if new_meta.get("managed", "True") != "False":
                    yield ("AddModel", {
                        "model": self.current_model_from_key(key), 
                        "model_def": new_fields,
                    })
                    # Also make sure we add any M2Ms it has.
                    for fieldname in new_m2ms:
                        # Only create its stuff if it wasn't a through=.
                        field = self.current_field_from_key(key, fieldname)
                        if auto_through(field):
                            yield ("AddM2M", {"model": self.current_model_from_key(key), "field": field})
                    # And any index/uniqueness constraints it has
                    for attr, operation in (("unique_together", "AddUnique"), ("index_together", "AddIndex")):
                        together = eval(new_meta.get(attr, "[]"))
                        if together:
                            # If it's only a single tuple, make it into the longer one
                            if isinstance(together[0], string_types):
                                together = [together]
                            # For each combination, make an action for it
                            for fields in together:
                                yield (operation, {
                                    "model": self.current_model_from_key(key),
                                    "fields": [self.current_model_from_key(key)._meta.get_field_by_name(x)[0] for x in fields],
                                })
        
        # Now, for every model that's stayed the same, check its fields.
        for key in self.old_defs:
            if key not in deleted_models:
                
                old_fields, old_meta, old_m2ms = self.split_model_def(self.old_orm[key], self.old_defs[key])
                new_fields, new_meta, new_m2ms = self.split_model_def(self.current_model_from_key(key), self.new_defs[key])
                
                # Do nothing for models which are now not managed.
                if new_meta.get("managed", "True") == "False":
                    continue
                
                # Find fields that have vanished.
                for fieldname in old_fields:
                    if fieldname not in new_fields:
                        # Don't do it for any fields we're ignoring
                        field = self.old_orm[key + ":" + fieldname]
                        field_allowed = True
                        for field_type in self.IGNORED_FIELD_TYPES:
                            if isinstance(field, field_type):
                                field_allowed = False
                        if field_allowed:
                            # Looks alright.
                            yield ("DeleteField", {
                                "model": self.old_orm[key],
                                "field": field,
                                "field_def": old_fields[fieldname],
                            })
                
                # And ones that have appeared
                for fieldname in new_fields:
                    if fieldname not in old_fields:
                        # Don't do it for any fields we're ignoring
                        field = self.current_field_from_key(key, fieldname)
                        field_allowed = True
                        for field_type in self.IGNORED_FIELD_TYPES:
                            if isinstance(field, field_type):
                                field_allowed = False
                        if field_allowed:
                            # Looks alright.
                            yield ("AddField", {
                                "model": self.current_model_from_key(key),
                                "field": field,
                                "field_def": new_fields[fieldname],
                            })
                
                # Find M2Ms that have vanished
                for fieldname in old_m2ms:
                    if fieldname not in new_m2ms:
                        # Only delete its stuff if it wasn't a through=.
                        field = self.old_orm[key + ":" + fieldname]
                        if auto_through(field):
                            yield ("DeleteM2M", {"model": self.old_orm[key], "field": field})
                
                # Find M2Ms that have appeared
                for fieldname in new_m2ms:
                    if fieldname not in old_m2ms:
                        # Only create its stuff if it wasn't a through=.
                        field = self.current_field_from_key(key, fieldname)
                        if auto_through(field):
                            yield ("AddM2M", {"model": self.current_model_from_key(key), "field": field})
                
                # For the ones that exist in both models, see if they were changed
                for fieldname in set(old_fields).intersection(set(new_fields)):
                    # Non-index changes
                    if self.different_attributes(
                     remove_useless_attributes(old_fields[fieldname], True, True),
                     remove_useless_attributes(new_fields[fieldname], True, True)):
                        yield ("ChangeField", {
                            "model": self.current_model_from_key(key),
                            "old_field": self.old_orm[key + ":" + fieldname],
                            "new_field": self.current_field_from_key(key, fieldname),
                            "old_def": old_fields[fieldname],
                            "new_def": new_fields[fieldname],
                        })
                    # Index changes
                    old_field = self.old_orm[key + ":" + fieldname]
                    new_field = self.current_field_from_key(key, fieldname)
                    if not old_field.db_index and new_field.db_index:
                        # They've added an index.
                        yield ("AddIndex", {
                            "model": self.current_model_from_key(key),
                            "fields": [new_field],
                        })
                    if old_field.db_index and not new_field.db_index:
                        # They've removed an index.
                        yield ("DeleteIndex", {
                            "model": self.old_orm[key],
                            "fields": [old_field],
                        })
                    # See if their uniques have changed
                    if old_field.unique != new_field.unique:
                        # Make sure we look at the one explicitly given to see what happened
                        if new_field.unique:
                            yield ("AddUnique", {
                                "model": self.current_model_from_key(key),
                                "fields": [new_field],
                            })
                        else:
                            yield ("DeleteUnique", {
                                "model": self.old_orm[key],
                                "fields": [old_field],
                            })
                
                # See if there's any M2Ms that have changed.
                for fieldname in set(old_m2ms).intersection(set(new_m2ms)):
                    old_field = self.old_orm[key + ":" + fieldname]
                    new_field = self.current_field_from_key(key, fieldname)
                    # Have they _added_ a through= ?
                    if auto_through(old_field) and not auto_through(new_field):
                        yield ("DeleteM2M", {"model": self.old_orm[key], "field": old_field})
                    # Have they _removed_ a through= ?
                    if not auto_through(old_field) and auto_through(new_field):
                        yield ("AddM2M", {"model": self.current_model_from_key(key), "field": new_field})
                
                ## See if the {index,unique}_togethers have changed
                for attr, add_operation, del_operation in (("unique_together", "AddUnique", "DeleteUnique"), ("index_together", "AddIndex", "DeleteIndex")):
                    # First, normalise them into lists of sets.
                    old_together = eval(old_meta.get(attr, "[]"))
                    new_together = eval(new_meta.get(attr, "[]"))
                    if old_together and isinstance(old_together[0], string_types):
                        old_together = [old_together]
                    if new_together and isinstance(new_together[0], string_types):
                        new_together = [new_together]
                    old_together = frozenset(tuple(o) for o in old_together)
                    new_together = frozenset(tuple(n) for n in new_together)
                    # See if any appeared or disappeared
                    disappeared = old_together.difference(new_together)
                    appeared = new_together.difference(old_together)
                    for item in disappeared:
                        yield (del_operation, {
                            "model": self.old_orm[key],
                            "fields": [self.old_orm[key + ":" + x] for x in item],
                        })
                    for item in appeared:
                        yield (add_operation, {
                            "model": self.current_model_from_key(key),
                            "fields": [self.current_field_from_key(key, x) for x in item],
                        })

    @classmethod
    def is_triple(cls, triple):
        "Returns whether the argument is a triple."
        return isinstance(triple, (list, tuple)) and len(triple) == 3 and \
            isinstance(triple[0], string_types) and \
            isinstance(triple[1], (list, tuple)) and \
            isinstance(triple[2], dict)

    @classmethod
    def different_attributes(cls, old, new):
        """
        Backwards-compat comparison that ignores orm. on the RHS and not the left
        and which knows django.db.models.fields.CharField = models.CharField.
        Has a whole load of tests in tests/autodetection.py.
        """
        
        # If they're not triples, just do normal comparison
        if not cls.is_triple(old) or not cls.is_triple(new):
            return old != new
        
        # Expand them out into parts
        old_field, old_pos, old_kwd = old
        new_field, new_pos, new_kwd = new
        
        # Copy the positional and keyword arguments so we can compare them and pop off things
        old_pos, new_pos = old_pos[:], new_pos[:]
        old_kwd = dict(old_kwd.items())
        new_kwd = dict(new_kwd.items())
        
        # Remove comparison of the existence of 'unique', that's done elsewhere.
        # TODO: Make this work for custom fields where unique= means something else?
        if "unique" in old_kwd:
            del old_kwd['unique']
        if "unique" in new_kwd:
            del new_kwd['unique']
        
        # If the first bit is different, check it's not by dj.db.models...
        if old_field != new_field:
            if old_field.startswith("models.") and (new_field.startswith("django.db.models") \
             or new_field.startswith("django.contrib.gis")):
                if old_field.split(".")[-1] != new_field.split(".")[-1]:
                    return True
                else:
                    # Remove those fields from the final comparison
                    old_field = new_field = ""
        
        # If there's a positional argument in the first, and a 'to' in the second,
        # see if they're actually comparable.
        if (old_pos and "to" in new_kwd) and ("orm" in new_kwd['to'] and "orm" not in old_pos[0]):
            # Do special comparison to fix #153
            try:
                if old_pos[0] != new_kwd['to'].split("'")[1].split(".")[1]:
                    return True
            except IndexError:
                pass # Fall back to next comparison
            # Remove those attrs from the final comparison
            old_pos = old_pos[1:]
            del new_kwd['to']
        
        return old_field != new_field or old_pos != new_pos or old_kwd != new_kwd


class ManualChanges(BaseChanges):
    """
    Detects changes by reading the command line.
    """
    
    def __init__(self, migrations, added_models, added_fields, added_indexes):
        self.migrations = migrations
        self.added_models = added_models
        self.added_fields = added_fields
        self.added_indexes = added_indexes
    
    def suggest_name(self):
        bits = []
        for model_name in self.added_models:
            bits.append('add_model_%s' % model_name)
        for field_name in self.added_fields:
            bits.append('add_field_%s' % field_name)
        for index_name in self.added_indexes:
            bits.append('add_index_%s' % index_name)
        return '_'.join(bits).replace('.', '_')
    
    def get_changes(self):
        # Get the model defs so we can use them for the yield later
        model_defs = freeze_apps([self.migrations.app_label()])
        # Make the model changes
        for model_name in self.added_models:
            model = models.get_model(self.migrations.app_label(), model_name)
            real_fields, meta, m2m_fields = self.split_model_def(model, model_defs[model_key(model)])
            yield ("AddModel", {
                "model": model,
                "model_def": real_fields,
            })
        # And the field changes
        for field_desc in self.added_fields:
            try:
                model_name, field_name = field_desc.split(".")
            except (TypeError, ValueError):
                raise ValueError("%r is not a valid field description." % field_desc)
            model = models.get_model(self.migrations.app_label(), model_name)
            real_fields, meta, m2m_fields = self.split_model_def(model, model_defs[model_key(model)])
            yield ("AddField", {
                "model": model,
                "field": model._meta.get_field_by_name(field_name)[0],
                "field_def": real_fields[field_name],
            })
        # And the indexes
        for field_desc in self.added_indexes:
            try:
                model_name, field_name = field_desc.split(".")
            except (TypeError, ValueError):
                print("%r is not a valid field description." % field_desc)
            model = models.get_model(self.migrations.app_label(), model_name)
            yield ("AddIndex", {
                "model": model,
                "fields": [model._meta.get_field_by_name(field_name)[0]],
            })
    
    
class InitialChanges(BaseChanges):
    """
    Creates all models; handles --initial.
    """
    def suggest_name(self):
        return 'initial'
    
    def __init__(self, migrations):
        self.migrations = migrations
    
    def get_changes(self):
        # Get the frozen models for this app
        model_defs = freeze_apps([self.migrations.app_label()])
        
        for model in models.get_models(models.get_app(self.migrations.app_label())):
            
            # Don't do anything for unmanaged, abstract or proxy models
            if model._meta.abstract or getattr(model._meta, "proxy", False) or not getattr(model._meta, "managed", True):
                continue
            
            real_fields, meta, m2m_fields = self.split_model_def(model, model_defs[model_key(model)])
            
            # Firstly, add the main table and fields
            yield ("AddModel", {
                "model": model,
                "model_def": real_fields,
            })
            
            # Then, add any indexing/uniqueness that's around
            if meta:
                for attr, operation in (("unique_together", "AddUnique"), ("index_together", "AddIndex")):
                    together = eval(meta.get(attr, "[]"))
                    if together:
                        # If it's only a single tuple, make it into the longer one
                        if isinstance(together[0], string_types):
                            together = [together]
                        # For each combination, make an action for it
                        for fields in together:
                            yield (operation, {
                                "model": model,
                                "fields": [model._meta.get_field_by_name(x)[0] for x in fields],
                            })
            
            # Finally, see if there's some M2M action
            for name, triple in m2m_fields.items():
                field = model._meta.get_field_by_name(name)[0]
                # But only if it's not through=foo (#120)
                if field.rel.through:
                    try:
                        # Django 1.1 and below
                        through_model = field.rel.through_model
                    except AttributeError:
                        # Django 1.2
                        through_model = field.rel.through
                if (not field.rel.through) or getattr(through_model._meta, "auto_created", False):
                    yield ("AddM2M", {
                        "model": model,
                        "field": field,
                    })
