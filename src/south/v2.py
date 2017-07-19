"""
API versioning file; we can tell what kind of migrations things are
by what class they inherit from (if none, it's a v1).
"""

from south.utils import ask_for_it_by_name

class BaseMigration(object):
    
    def gf(self, field_name):
        "Gets a field by absolute reference."
        field = ask_for_it_by_name(field_name)
        field.model = FakeModel
        return field

class SchemaMigration(BaseMigration):
    pass

class DataMigration(BaseMigration):
    # Data migrations shouldn't be dry-run
    no_dry_run = True

class FakeModel(object):
    "Fake model so error messages on fields don't explode"
    pass
