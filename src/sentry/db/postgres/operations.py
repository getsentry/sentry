from django.db.backends.postgresql.operations import DatabaseOperations as DjangoDatabaseOperations


class DatabaseOperations(DjangoDatabaseOperations):
    # Remove HOST() lookups for GenericIPAddressField
    def field_cast_sql(self, db_type, internal_type):
        return "%s"
