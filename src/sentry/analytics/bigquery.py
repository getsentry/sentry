from __future__ import absolute_import

__all__ = ('BigQueryAnalytics',)

from google.cloud import bigquery

from .base import Analytics


class BigQueryAnalytics(Analytics):
    def __init__(self, project=None, credentials=None,
                 dataset='sentry_analytics', table='events'):
        super(BigQueryAnalytics, self).__init__()
        self.client = bigquery.Client(
            project=project,
            credentials=credentials,
        )
        self.dataset = self.client.dataset(dataset)
        self.table = self.dataset.table(table)

    def record_event(self, event):
        """
        >>> record_event(Event())
        """
        self.table.insert_data([event.serialize()])
