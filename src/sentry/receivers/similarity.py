from __future__ import absolute_import

from sentry import features as feature_flags
from sentry.signals import event_processed
from sentry.similarity import features as similarity_features


@event_processed.connect(weak=False)
def record(project, event, **kwargs):
    if not feature_flags.has("projects:similarity-indexing", project):
        return

    similarity_features.record([event])
