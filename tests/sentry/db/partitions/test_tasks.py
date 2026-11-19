from unittest import mock

from sentry.db.partitions.tasks import maintain_partitions


@mock.patch("sentry.db.partitions.manager.maintain_partitions")
def test_maintain_partitions(maintain: mock.MagicMock) -> None:
    maintain_partitions()
    maintain.assert_called_once_with()
