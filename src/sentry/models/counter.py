from __future__ import absolute_import

from django.db import connection, connections
from django.db.models.signals import post_migrate

from sentry.db.models import FlexibleForeignKey, Model, sane_repr, BoundedBigIntegerField


class Counter(Model):
    __core__ = True

    project = FlexibleForeignKey("sentry.Project", unique=True)
    value = BoundedBigIntegerField()

    __repr__ = sane_repr("project")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectcounter"

    @classmethod
    def increment(cls, project, delta=1):
        """Increments a counter.  This can never decrement."""
        return increment_project_counter(project, delta)


def increment_project_counter(project, delta=1):
    """This method primarily exists so that south code can use it."""
    if delta <= 0:
        raise ValueError("There is only one way, and that's up.")

    cur = connection.cursor()
    try:
        cur.execute(
            """
            select sentry_increment_project_counter(%s, %s)
        """,
            [project.id, delta],
        )
        return cur.fetchone()[0]
    finally:
        cur.close()


# this must be idempotent because it seems to execute twice
# (at least during test runs)
def create_counter_function(app_config, using, **kwargs):
    if app_config and app_config.name != "sentry":
        return

    try:
        app_config.get_model("Counter")
    except LookupError:
        return

    cursor = connections[using].cursor()
    try:
        cursor.execute(
            """
            create or replace function sentry_increment_project_counter(
                project bigint, delta int) returns int as $$
            declare
            new_val int;
            begin
            loop
                update sentry_projectcounter set value = value + delta
                where project_id = project
                returning value into new_val;
                if found then
                return new_val;
                end if;
                begin
                insert into sentry_projectcounter(project_id, value)
                    values (project, delta)
                    returning value into new_val;
                return new_val;
                exception when unique_violation then
                end;
            end loop;
            end
            $$ language plpgsql;
        """
        )
    finally:
        cursor.close()


post_migrate.connect(create_counter_function, dispatch_uid="create_counter_function", weak=False)
