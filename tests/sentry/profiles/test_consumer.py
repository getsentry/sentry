from datetime import datetime
from unittest.mock import Mock

import msgpack
from exam import fixture

from sentry.profiles.consumer import ProfilesConsumer
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.utils import json


class ProfilesConsumerTest(TestCase, SnubaTestCase):
    @fixture
    def valid_message(self):
        return {
            "organization_id": 1,
            "project_id": 1,
            "received": int(datetime.utcnow().timestamp()),
            "payload": json.dumps({"platform": "android", "profile": ""}),
        }

    def test_process(self):
        consumer = ProfilesConsumer()
        message = Mock()
        message.value.return_value = msgpack.packb(self.valid_message)
        profile = consumer.process_message(message)

        for k in ["organization_id", "project_id", "received"]:
            assert k in profile

        assert isinstance(profile["received"], int)
