from sentry.models import Project
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

projects_updated = 0
for p in RangeQuerySetWrapperWithProgressBar(Project.objects.all()):
    # Reset expiry if it's run for at least a week
    # 1691035200 -> Thu Aug 03 2023 04:00:00 GMT+0000
    if (
        p.get_option("sentry:grouping_auto_update")
        and p.get_option("sentry:grouping_config") == "newstyle:2023-01-11"
        and p.get_option("sentry:secondary_grouping_config") == "newstyle:2019-10-29"
        and (p.get_option("sentry:secondary_grouping_expiry") <= 1691035200)
    ):
        # Deleting this field resets to 0 since it's the default value
        p.delete_option("sentry:secondary_grouping_expiry")
        projects_updated += 1

print(projects_updated)
