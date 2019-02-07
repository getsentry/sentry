from __future__ import absolute_import

import urllib3

from sentry.eventstream.kafka import KafkaEventStream
from sentry.eventstream.kafka.backend import EVENT_PROTOCOL_VERSION
from sentry.utils import snuba, json


class SnubaEventStream(KafkaEventStream):
    def _send(self, project_id, _type, extra_data=(), asynchronous=True):
        data = (EVENT_PROTOCOL_VERSION, _type) + extra_data

        try:
            resp = snuba._snuba_pool.urlopen(
                'POST', '/tests/eventstream',
                body=json.dumps(data),
            )
            if resp.status != 200:
                raise snuba.SnubaError("HTTP %s response from Snuba!" % resp.status)
            return resp
        except urllib3.exceptions.HTTPError as err:
            raise snuba.SnubaError(err)
