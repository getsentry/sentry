import logging
from collections.abc import Mapping

from sentry.buffer.redis import BufferHookEvent, RedisBuffer, redis_buffer_registry
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.safe import safe_execute

logger = logging.getLogger("sentry.rules.delayed_processing")


PROJECT_ID_BUFFER_LIST_KEY = "project_id_buffer_list"


@redis_buffer_registry.add_handler(BufferHookEvent.FLUSH)
def process_delayed_alert_conditions(buffer: RedisBuffer) -> None:
    with metrics.timer("delayed_processing.process_all_conditions.duration"):
        project_ids = buffer.get_set(PROJECT_ID_BUFFER_LIST_KEY)

        for project in RangeQuerySetWrapper(Project.objects.filter(id__in=project_ids)):
            rulegroup_event_mapping = buffer.get_hash(
                model=Project, field={"project_id": project.id}
            )

            with metrics.timer("delayed_processing.process_project.duration"):
                safe_execute(
                    apply_delayed,
                    project,
                    rulegroup_event_mapping,
                    _with_transaction=False,
                )


def apply_delayed(project: Project, rule_group_pairs: Mapping[str, str]) -> None:
    pass
