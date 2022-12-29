from django.db import connections, router

from sentry.db.models import Model


# An empty table that provides a postgres sequence which can be used to generate sequence values for
# snowflake id generation
class SnowflakeSeq(Model):
    __include_in_export__ = False

    @classmethod
    def next_seq(cls):
        with connections[router.db_for_write(cls)].cursor() as cursor:
            cursor.execute("SELECT nextval(%s)", [f"{cls._meta.db_table}_id_seq"])
            return cursor.fetchone()[0]

    class Meta:
        app_label = "sentry"
        db_table = "sentry_snowflakeseq"
