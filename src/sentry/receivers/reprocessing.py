from sentry.models import ProjectOption
from sentry.signals import buffer_incr_complete


@buffer_incr_complete.connect(
    sender=ProjectOption, dispatch_uid="bump_reprocessing_revision_receiver", weak=False
)
def bump_reprocessing_revision_receiver(filters, **_):
    from sentry.reprocessing import REPROCESSING_OPTION, bump_reprocessing_revision

    if filters.get("key") == REPROCESSING_OPTION:
        bump_reprocessing_revision(filters["project"], use_buffer=False)
