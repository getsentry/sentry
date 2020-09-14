from __future__ import absolute_import

from sentry import features as feature_flags
from sentry import similarity
from sentry.signals import event_processed
from sentry.utils.safe import safe_execute


@event_processed.connect(weak=False)
def record(project, event, **kwargs):
    if feature_flags.has("projects:similarity-indexing", project):
        safe_execute(similarity.features.record, [event])

    if feature_flags.has("projects:similarity-indexing-v2", project):
        safe_execute(similarity.features2.record, [event])
