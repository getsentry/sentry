from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.signals import buffer_incr_complete


@buffer_incr_complete.connect(
    sender=ProjectOption, dispatch_uid="bump_reprocessing_revision_receiver", weak=False
)
def bump_reprocessing_revision_receiver(filters, **_):
    from sentry.reprocessing import REPROCESSING_OPTION, bump_reprocessing_revision

    if filters.get("key") == REPROCESSING_OPTION:
        bump_reprocessing_revision(
            Project.objects.get_from_cache(id=filters["project_id"]), use_buffer=False
        )
