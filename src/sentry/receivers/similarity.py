from __future__ import absolute_import

from sentry import similarity
from sentry.signals import event_processed
from sentry.utils.safe import safe_execute


@event_processed.connect(weak=False)
def record(project, event, **kwargs):
    safe_execute(similarity.record, project, [event])
