import logging
from collections.abc import Mapping

from sentry.buffer.redis import RedisBuffer
from sentry.models.project import Project
from sentry.utils.safe import safe_execute

logger = logging.getLogger("sentry.rules.delayed_processing")


# TODO(schew2381): Import once available
PROJECT_ID_BUFFER_LIST_KEY = "project_id_buffer_list"


# TODO: Add redis buffer registry decorator
def process_delayed_alert_conditions(buffer: RedisBuffer) -> None:
    project_ids = buffer.get_list(PROJECT_ID_BUFFER_LIST_KEY)

    project_mapping = Project.objects.in_bulk(set(project_ids))

    for project_id, project in project_mapping.items():
        rulegroup_event_mapping: dict[str, int] = buffer.get_queue(Project, {id: project_id})
        safe_execute(
            apply_delayed,
            project,
            rulegroup_event_mapping,
            _with_transaction=False,
        )


def apply_delayed(project: Project, rule_group_pairs: Mapping[str, int]) -> None:
    pass
