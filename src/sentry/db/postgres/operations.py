from django.db.backends.postgresql_psycopg2.base import DatabaseOperations


class DatabaseOperations(DatabaseOperations):
    # Remove HOST() lookups for GenericIPAddressField
    def field_cast_sql(self, db_type, internal_type):
        return "%s"
