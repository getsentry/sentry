import logging
from collections.abc import Mapping

from sentry.buffer.redis import BufferHookEvent, RedisBuffer, redis_buffer_registry
from sentry.models.project import Project
from sentry.utils.safe import safe_execute

logger = logging.getLogger("sentry.rules.delayed_processing")


PROJECT_ID_BUFFER_LIST_KEY = "project_id_buffer_list"


@redis_buffer_registry.add_handler(BufferHookEvent.FLUSH)
def process_delayed_alert_conditions(buffer: RedisBuffer) -> None:
    project_ids = buffer.get_set(PROJECT_ID_BUFFER_LIST_KEY)

    project_mapping = Project.objects.in_bulk(set(project_ids))

    for project_id, project in project_mapping.items():
        rulegroup_event_mapping: dict[str, int] = buffer.get_hash(Project, {id: project_id})
        safe_execute(
            apply_delayed,
            project,
            rulegroup_event_mapping,
            _with_transaction=False,
        )


def apply_delayed(project: Project, rule_group_pairs: Mapping[str, str]) -> None:
    pass
