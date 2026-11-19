from unittest import mock

import pytest
from taskbroker_client.task import Task

from sentry.conf.server import TASKWORKER_CONTROL_SCHEDULES, TASKWORKER_REGION_SCHEDULES
from sentry.db.partitions.tasks import maintain_partitions, maintain_partitions_control
from sentry.silo.base import SiloMode
from sentry.testutils.silo import assume_test_silo_mode


@pytest.mark.parametrize(
    ("task", "silo_mode"),
    [(maintain_partitions, SiloMode.CELL), (maintain_partitions_control, SiloMode.CONTROL)],
)
@mock.patch("sentry.db.partitions.manager.maintain_partitions")
def test_maintain_partitions(
    maintain: mock.MagicMock, task: Task[[], None], silo_mode: SiloMode
) -> None:
    with assume_test_silo_mode(silo_mode):
        task()
    maintain.assert_called_once_with()


def test_scheduled_in_both_silos() -> None:
    assert TASKWORKER_REGION_SCHEDULES["maintain-partitions"]["task"] == (
        "db:sentry.db.partitions.tasks.maintain_partitions"
    )
    assert TASKWORKER_CONTROL_SCHEDULES["maintain-partitions-control"]["task"] == (
        "db.control:sentry.db.partitions.tasks.maintain_partitions_control"
    )
