from __future__ import absolute_import

from exam import fixture

from sentry.models import Project
from sentry.signals import event_processed
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class RecordFirstTransactionTest(TestCase):
    @fixture
    def min_ago(self):
        return iso_format(before_now(minutes=1))

    def test_transaction_processed(self):
        assert not self.project.flags.has_transactions
        event = self.store_event(
            data={
                "type": "transaction",
                "timestamp": self.min_ago,
                "start_timestamp": self.min_ago,
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
        )

        event_processed.send(project=self.project, event=event, sender=type(self.project))
        project = Project.objects.get(id=self.project.id)
        assert project.flags.has_transactions

    def test_transaction_processed_no_platform(self):
        assert not self.project.flags.has_transactions
        event = self.store_event(
            data={
                "type": "transaction",
                "platform": None,
                "timestamp": self.min_ago,
                "start_timestamp": self.min_ago,
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
        )

        event_processed.send(project=self.project, event=event, sender=type(self.project))
        project = Project.objects.get(id=self.project.id)
        assert project.flags.has_transactions

    def test_event_processed(self):
        assert not self.project.flags.has_transactions
        event = self.store_event(
            data={"type": "default", "timestamp": self.min_ago}, project_id=self.project.id
        )

        event_processed.send(project=self.project, event=event, sender=type(self.project))
        project = Project.objects.get(id=self.project.id)
        assert not project.flags.has_transactions
