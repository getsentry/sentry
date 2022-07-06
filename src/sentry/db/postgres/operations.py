from django.db.backends.postgresql.base import DatabaseOperations


class DatabaseOperations(DatabaseOperations):
    # Remove HOST() lookups for GenericIPAddressField
    def field_cast_sql(self, db_type, internal_type):
        return "%s"
