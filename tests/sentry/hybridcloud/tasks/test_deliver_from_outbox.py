from unittest.mock import Mock, patch

import pytest
from django.db import ProgrammingError
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry.hybridcloud.models.outbox import CellOutbox, OutboxFlushError, outbox_context
from sentry.hybridcloud.tasks.deliver_from_outbox import process_outbox_batch
from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase

ALL_IDS = 2**62


@patch("sentry.hybridcloud.tasks.deliver_from_outbox.in_test_environment", return_value=False)
class ProcessOutboxBatchTest(TestCase):
    def setUp(self) -> None:
        with outbox_context(flush=False):
            Organization(id=10).outbox_for_update().save()
            Organization(id=11).outbox_for_update().save()

    @patch.object(CellOutbox, "drain_shard")
    def test_continues_past_ordinary_errors(self, mock_drain: Mock, _: Mock) -> None:
        mock_drain.side_effect = OutboxFlushError("boom", CellOutbox())

        assert process_outbox_batch(ALL_IDS, 0, CellOutbox) == 2
        assert mock_drain.call_count == 2

    @patch.object(CellOutbox, "drain_shard")
    def test_propagates_bare_processing_deadline(self, mock_drain: Mock, _: Mock) -> None:
        mock_drain.side_effect = ProcessingDeadlineExceeded("execution deadline exceeded")

        with pytest.raises(ProcessingDeadlineExceeded):
            process_outbox_batch(ALL_IDS, 0, CellOutbox)
        assert mock_drain.call_count == 1

    @patch.object(CellOutbox, "drain_shard")
    def test_reraises_errors_caused_by_processing_deadline(self, mock_drain: Mock, _: Mock) -> None:
        def drain(*args: object, **kwargs: object) -> None:
            try:
                try:
                    raise ProcessingDeadlineExceeded("execution deadline exceeded")
                except ProcessingDeadlineExceeded:
                    raise ProgrammingError("set_session cannot be used inside a transaction")
            except ProgrammingError as e:
                raise OutboxFlushError("Could not flush shard", CellOutbox()) from e

        mock_drain.side_effect = drain

        with pytest.raises(OutboxFlushError):
            process_outbox_batch(ALL_IDS, 0, CellOutbox)
        assert mock_drain.call_count == 1
