"""
Actions - things like 'a model was removed' or 'a field was changed'.
Each one has a class, which can take the action description and insert code
blocks into the forwards() and backwards() methods, in the right place.
"""

from __future__ import print_function

import sys

from django.db.models.fields.related import RECURSIVE_RELATIONSHIP_CONSTANT
from django.db.models.fields import FieldDoesNotExist, NOT_PROVIDED, CharField, TextField

from south.modelsinspector import value_clean
from south.creator.freezer import remove_useless_attributes, model_key
from south.utils import datetime_utils
from south.utils.py3 import raw_input


class Action(object):
    """
    Generic base Action class. Contains utility methods for inserting into
    the forwards() and backwards() method lists.
    """
    
    prepend_forwards = False
    prepend_backwards = False
    
    def forwards_code(self):
        raise NotImplementedError
    
    def backwards_code(self):
        raise NotImplementedError
    
    def add_forwards(self, forwards):
        if self.prepend_forwards:
            forwards.insert(0, self.forwards_code())
        else:
            forwards.append(self.forwards_code())
    
    def add_backwards(self, backwards):
        if self.prepend_backwards:
            backwards.insert(0, self.backwards_code())
        else:
            backwards.append(self.backwards_code())
    
    def console_line(self):
        "Returns the string to print on the console, e.g. ' + Added field foo'"
        raise NotImplementedError
    
    @classmethod
    def triples_to_defs(cls, fields):
        # Turn the (class, args, kwargs) format into a string
        for field, triple in fields.items():
            fields[field] = cls.triple_to_def(triple)
        return fields
    
    @classmethod
    def triple_to_def(cls, triple):
        "Turns a single triple into a definition."
        return "self.gf(%r)(%s)" % (
            triple[0], # Field full path
            ", ".join(triple[1] + ["%s=%s" % (kwd, val) for kwd, val in triple[2].items()]), # args and kwds
        )
    
    
class AddModel(Action):
    """
    Addition of a model. Takes the Model subclass that is being created.
    """
    
    FORWARDS_TEMPLATE = '''
        # Adding model '%(model_name)s'
        db.create_table(%(table_name)r, (
            %(field_defs)s
        ))
        db.send_create_signal(%(app_label)r, [%(model_name)r])'''[1:] + "\n"
    
    BACKWARDS_TEMPLATE = '''
        # Deleting model '%(model_name)s'
        db.delete_table(%(table_name)r)'''[1:] + "\n"

    def __init__(self, model, model_def):
        self.model = model
        self.model_def = model_def
    
    def console_line(self):
        "Returns the string to print on the console, e.g. ' + Added field foo'"
        return " + Added model %s.%s" % (
            self.model._meta.app_label, 
            self.model._meta.object_name,
        )

    def forwards_code(self):
        "Produces the code snippet that gets put into forwards()"
        field_defs = ",\n            ".join([
            "(%r, %s)" % (name, defn) for name, defn
            in self.triples_to_defs(self.model_def).items()
        ]) + ","
        
        return self.FORWARDS_TEMPLATE % {
            "model_name": self.model._meta.object_name,
            "table_name": self.model._meta.db_table,
            "app_label": self.model._meta.app_label,
            "field_defs": field_defs,
        }

    def backwards_code(self):
        "Produces the code snippet that gets put into backwards()"
        return self.BACKWARDS_TEMPLATE % {
            "model_name": self.model._meta.object_name,
            "table_name": self.model._meta.db_table,
        }
    
    
class DeleteModel(AddModel):
    """
    Deletion of a model. Takes the Model subclass that is being created.
    """
    
    def console_line(self):
        "Returns the string to print on the console, e.g. ' + Added field foo'"
        return " - Deleted model %s.%s" % (
            self.model._meta.app_label, 
            self.model._meta.object_name,
        )

    def forwards_code(self):
        return AddModel.backwards_code(self)

    def backwards_code(self):
        return AddModel.forwards_code(self)


class _NullIssuesField(object):
    """
    A field that might need to ask a question about rogue NULL values.
    """

    issue_with_backward_migration = False
    irreversible = False

    IRREVERSIBLE_TEMPLATE = '''
        # User chose to not deal with backwards NULL issues for '%(model_name)s.%(field_name)s'
        raise RuntimeError("Cannot reverse this migration. '%(model_name)s.%(field_name)s' and its values cannot be restored.")
        
        # The following code is provided here to aid in writing a correct migration'''

    def deal_with_not_null_no_default(self, field, field_def):
        # If it's a CharField or TextField that's blank, skip this step.
        if isinstance(field, (CharField, TextField)) and field.blank:
            field_def[2]['default'] = repr("")
            return
        # Oh dear. Ask them what to do.
        print(" ? The field '%s.%s' does not have a default specified, yet is NOT NULL." % (
            self.model._meta.object_name,
            field.name,
        ))
        print(" ? Since you are %s, you MUST specify a default" % self.null_reason)
        print(" ? value to use for existing rows. Would you like to:")
        print(" ?  1. Quit now"+("." if self.issue_with_backward_migration else ", and add a default to the field in models.py" ))
        print(" ?  2. Specify a one-off value to use for existing columns now")
        if self.issue_with_backward_migration:
            print(" ?  3. Disable the backwards migration by raising an exception; you can edit the migration to fix it later")
        while True:
            choice = raw_input(" ? Please select a choice: ")
            if choice == "1":
                sys.exit(1)
            elif choice == "2":
                break
            elif choice == "3" and self.issue_with_backward_migration:
                break
            else:
                print(" ! Invalid choice.")
        if choice == "2":
            self.add_one_time_default(field, field_def)
        elif choice == "3":
            self.irreversible = True

    def add_one_time_default(self, field, field_def):
        # OK, they want to pick their own one-time default. Who are we to refuse?
        print(" ? Please enter Python code for your one-off default value.")
        print(" ? The datetime module is available, so you can do e.g. datetime.date.today()")
        while True:
            code = raw_input(" >>> ")
            if not code:
                print(" ! Please enter some code, or 'exit' (with no quotes) to exit.")
            elif code == "exit":
                sys.exit(1)
            else:
                try:
                    result = eval(code, {}, {"datetime": datetime_utils})
                except (SyntaxError, NameError) as e:
                    print(" ! Invalid input: %s" % e)
                else:
                    break
        # Right, add the default in.
        field_def[2]['default'] = value_clean(result)

    def irreversable_code(self, field):
        return self.IRREVERSIBLE_TEMPLATE % {
            "model_name": self.model._meta.object_name,
            "table_name": self.model._meta.db_table,
            "field_name": field.name,
            "field_column": field.column,
        }
    
    
class AddField(Action, _NullIssuesField):
    """
    Adds a field to a model. Takes a Model class and the field name.
    """

    null_reason = "adding this field"
    
    FORWARDS_TEMPLATE = '''
        # Adding field '%(model_name)s.%(field_name)s'
        db.add_column(%(table_name)r, %(field_name)r,
                      %(field_def)s,
                      keep_default=False)'''[1:] + "\n"
    
    BACKWARDS_TEMPLATE = '''
        # Deleting field '%(model_name)s.%(field_name)s'
        db.delete_column(%(table_name)r, %(field_column)r)'''[1:] + "\n"
    
    def __init__(self, model, field, field_def):
        self.model = model
        self.field = field
        self.field_def = field_def
        
        # See if they've made a NOT NULL column but also have no default (far too common)
        is_null = self.field.null
        default = (self.field.default is not None) and (self.field.default is not NOT_PROVIDED)
        
        if not is_null and not default:
            self.deal_with_not_null_no_default(self.field, self.field_def)

    def console_line(self):
        "Returns the string to print on the console, e.g. ' + Added field foo'"
        return " + Added field %s on %s.%s" % (
            self.field.name,
            self.model._meta.app_label,
            self.model._meta.object_name,
        )
    
    def forwards_code(self):
        
        return self.FORWARDS_TEMPLATE % {
            "model_name": self.model._meta.object_name,
            "table_name": self.model._meta.db_table,
            "field_name": self.field.name,
            "field_column": self.field.column,
            "field_def": self.triple_to_def(self.field_def),
        }

    def backwards_code(self):
        return self.BACKWARDS_TEMPLATE % {
            "model_name": self.model._meta.object_name,
            "table_name": self.model._meta.db_table,
            "field_name": self.field.name,
            "field_column": self.field.column,
        }
    
    
class DeleteField(AddField):
    """
    Removes a field from a model. Takes a Model class and the field name.
    """

    null_reason = "removing this field"
    issue_with_backward_migration = True

    def console_line(self):
        "Returns the string to print on the console, e.g. ' + Added field foo'"
        return " - Deleted field %s on %s.%s" % (
            self.field.name,
            self.model._meta.app_label, 
            self.model._meta.object_name,
        )
    
    def forwards_code(self):
        return AddField.backwards_code(self)

    def backwards_code(self):
        if not self.irreversible:
            return AddField.forwards_code(self)
        else:
            return self.irreversable_code(self.field) + AddField.forwards_code(self)


class ChangeField(Action, _NullIssuesField):
    """
    Changes a field's type/options on a model.
    """

    null_reason = "making this field non-nullable"
    
    FORWARDS_TEMPLATE = BACKWARDS_TEMPLATE = '''
        # Changing field '%(model_name)s.%(field_name)s'
        db.alter_column(%(table_name)r, %(field_column)r, %(field_def)s)'''
    
    RENAME_TEMPLATE = '''
        # Renaming column for '%(model_name)s.%(field_name)s' to match new field type.
        db.rename_column(%(table_name)r, %(old_column)r, %(new_column)r)'''
    
    def __init__(self, model, old_field, new_field, old_def, new_def):
        self.model = model
        self.old_field = old_field
        self.new_field = new_field
        self.old_def = old_def
        self.new_def = new_def

        # See if they've changed a not-null field to be null
        new_default = (self.new_field.default is not None) and (self.new_field.default is not NOT_PROVIDED)
        old_default = (self.old_field.default is not None) and (self.old_field.default is not NOT_PROVIDED)
        if self.old_field.null and not self.new_field.null and not new_default:
            self.deal_with_not_null_no_default(self.new_field, self.new_def)
        if not self.old_field.null and self.new_field.null and not old_default:
            self.null_reason = "making this field nullable"
            self.issue_with_backward_migration = True
            self.deal_with_not_null_no_default(self.old_field, self.old_def)
    
    def console_line(self):
        "Returns the string to print on the console, e.g. ' + Added field foo'"
        return " ~ Changed field %s on %s.%s" % (
            self.new_field.name,
            self.model._meta.app_label, 
            self.model._meta.object_name,
        )
    
    def _code(self, old_field, new_field, new_def):
        
        output = ""
        
        if self.old_field.column != self.new_field.column:
            output += self.RENAME_TEMPLATE % {
                "model_name": self.model._meta.object_name,
                "table_name": self.model._meta.db_table,
                "field_name": new_field.name,
                "old_column": old_field.column,
                "new_column": new_field.column,
            }
        
        output += self.FORWARDS_TEMPLATE % {
            "model_name": self.model._meta.object_name,
            "table_name": self.model._meta.db_table,
            "field_name": new_field.name,
            "field_column": new_field.column,
            "field_def": self.triple_to_def(new_def),
        }
        
        return output

    def forwards_code(self):
        return self._code(self.old_field, self.new_field, self.new_def)

    def backwards_code(self):
        change_code = self._code(self.new_field, self.old_field, self.old_def)
        if not self.irreversible:
            return change_code
        else:
            return self.irreversable_code(self.old_field) + change_code


class AddUnique(Action):
    """
    Adds a unique constraint to a model. Takes a Model class and the field names.
    """
    
    FORWARDS_TEMPLATE = '''
        # Adding unique constraint on '%(model_name)s', fields %(field_names)s
        db.create_unique(%(table_name)r, %(fields)r)'''[1:] + "\n"
    
    BACKWARDS_TEMPLATE = '''
        # Removing unique constraint on '%(model_name)s', fields %(field_names)s
        db.delete_unique(%(table_name)r, %(fields)r)'''[1:] + "\n"
    
    prepend_backwards = True
    
    def __init__(self, model, fields):
        self.model = model
        self.fields = fields
    
    def console_line(self):
        "Returns the string to print on the console, e.g. ' + Added field foo'"
        return " + Added unique constraint for %s on %s.%s" % (
            [x.name for x in self.fields],
            self.model._meta.app_label, 
            self.model._meta.object_name,
        )
    
    def forwards_code(self):
        
        return self.FORWARDS_TEMPLATE % {
            "model_name": self.model._meta.object_name,
            "table_name": self.model._meta.db_table,
            "fields":  [field.column for field in self.fields],
            "field_names":  [field.name for field in self.fields],
        }

    def backwards_code(self):
        return self.BACKWARDS_TEMPLATE % {
            "model_name": self.model._meta.object_name,
            "table_name": self.model._meta.db_table,
            "fields": [field.column for field in self.fields],
            "field_names":  [field.name for field in self.fields],
        }


class DeleteUnique(AddUnique):
    """
    Removes a unique constraint from a model. Takes a Model class and the field names.
    """
    
    prepend_forwards = True
    prepend_backwards = False
    
    def console_line(self):
        "Returns the string to print on the console, e.g. ' + Added field foo'"
        return " - Deleted unique constraint for %s on %s.%s" % (
            [x.name for x in self.fields],
            self.model._meta.app_label, 
            self.model._meta.object_name,
        )
    
    def forwards_code(self):
        return AddUnique.backwards_code(self)

    def backwards_code(self):
        return AddUnique.forwards_code(self)


class AddIndex(AddUnique):
    """
    Adds an index to a model field[s]. Takes a Model class and the field names.
    """
    
    FORWARDS_TEMPLATE = '''
        # Adding index on '%(model_name)s', fields %(field_names)s
        db.create_index(%(table_name)r, %(fields)r)'''[1:] + "\n"
    
    BACKWARDS_TEMPLATE = '''
        # Removing index on '%(model_name)s', fields %(field_names)s
        db.delete_index(%(table_name)r, %(fields)r)'''[1:] + "\n"
    
    def console_line(self):
        "Returns the string to print on the console, e.g. ' + Added field foo'"
        return " + Added index for %s on %s.%s" % (
            [x.name for x in self.fields],
            self.model._meta.app_label, 
            self.model._meta.object_name,
        )


class DeleteIndex(AddIndex):
    """
    Deletes an index off a model field[s]. Takes a Model class and the field names.
    """
    
    def console_line(self):
        "Returns the string to print on the console, e.g. ' + Added field foo'"
        return " + Deleted index for %s on %s.%s" % (
            [x.name for x in self.fields],
            self.model._meta.app_label, 
            self.model._meta.object_name,
        )
    
    def forwards_code(self):
        return AddIndex.backwards_code(self)

    def backwards_code(self):
        return AddIndex.forwards_code(self)


class AddM2M(Action):
    """
    Adds a unique constraint to a model. Takes a Model class and the field names.
    """
    
    FORWARDS_TEMPLATE = '''
        # Adding M2M table for field %(field_name)s on '%(model_name)s'
        m2m_table_name = %(table_name)s
        db.create_table(m2m_table_name, (
            ('id', models.AutoField(verbose_name='ID', primary_key=True, auto_created=True)),
            (%(left_field)r, models.ForeignKey(orm[%(left_model_key)r], null=False)),
            (%(right_field)r, models.ForeignKey(orm[%(right_model_key)r], null=False))
        ))
        db.create_unique(m2m_table_name, [%(left_column)r, %(right_column)r])'''[1:] + "\n"
    
    BACKWARDS_TEMPLATE = '''
        # Removing M2M table for field %(field_name)s on '%(model_name)s'
        db.delete_table(%(table_name)s)'''[1:] + "\n"
    
    def __init__(self, model, field):
        self.model = model
        self.field = field
    
    def console_line(self):
        "Returns the string to print on the console, e.g. ' + Added field foo'"
        return " + Added M2M table for %s on %s.%s" % (
            self.field.name,
            self.model._meta.app_label, 
            self.model._meta.object_name,
        )

    def table_name(self):
        # This is part of a workaround for the fact that Django uses
        # different shortening for automatically generated m2m table names 
        # (as opposed to any explicitly specified table name)
        f = self.field
        explicit = f.db_table
        if explicit:
            return "%r" % explicit
        else:
            auto = "%s_%s" % (self.model._meta.db_table, f.name)
            return 'db.shorten_name(%r)' % auto

    def forwards_code(self):
        
        return self.FORWARDS_TEMPLATE % {
            "model_name": self.model._meta.object_name,
            "field_name": self.field.name,
            "table_name": self.table_name(),
            "left_field": self.field.m2m_column_name()[:-3], # Remove the _id part
            "left_column": self.field.m2m_column_name(),
            "left_model_key": model_key(self.model),
            "right_field": self.field.m2m_reverse_name()[:-3], # Remove the _id part
            "right_column": self.field.m2m_reverse_name(),
            "right_model_key": model_key(self.field.rel.to),
        }

    def backwards_code(self):
        
        return self.BACKWARDS_TEMPLATE % {
            "model_name": self.model._meta.object_name,
            "field_name": self.field.name,
            "table_name": self.table_name(),
        }


class DeleteM2M(AddM2M):
    """
    Adds a unique constraint to a model. Takes a Model class and the field names.
    """
    
    def console_line(self):
        "Returns the string to print on the console, e.g. ' + Added field foo'"
        return " - Deleted M2M table for %s on %s.%s" % (
            self.field.name,
            self.model._meta.app_label, 
            self.model._meta.object_name,
        )
    
    def forwards_code(self):
        return AddM2M.backwards_code(self)

    def backwards_code(self):
        return AddM2M.forwards_code(self)
    
