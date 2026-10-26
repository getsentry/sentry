from sentry.deletions.base import ModelDeletionTask
from sentry.incidents.models.incident import Incident


class IncidentDeletionTask(ModelDeletionTask[Incident]):
    # Historical identifiers belong to the open period. Retiring an Incident must
    # not remove the mapping used by notification payloads and legacy links.
    pass
