import click

from sentry.runner.decorators import configuration


@click.command()
@configuration
def invalidate_project_configs():
    """Gradually evict existing project configs from redis and recompute them.

    This can be used to speed up incident recovery, for example when faulty project configs
    that cannot be read by Relay have been written to redis.
    """
    from sentry.models import Organization
    from sentry.tasks.relay import schedule_invalidate_project_config
    from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

    # NOTE: Instead of iterating over all projects, we could use redis.scan_iter()
    # to evict only project configs that exist in redis.
    queryset = Organization.objects.all().values_list("id", flat=True)
    click.echo("Invalidating all project configs...")
    for org_id in RangeQuerySetWrapperWithProgressBar(queryset, result_value_getter=lambda x: x):
        schedule_invalidate_project_config(
            trigger="invalidate-all-orgs", organization_id=org_id, countdown=0
        )
