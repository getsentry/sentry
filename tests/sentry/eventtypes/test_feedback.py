from __future__ import annotations

from unittest import TestCase

from sentry.eventtypes.feedback import FeedbackEvent
from sentry.testutils.silo import region_silo_test


@region_silo_test
class GetMetadataTest(TestCase):
    def test_simple(self):
        inst = FeedbackEvent()
        data = {
            "contexts": {
                "feedback": {
                    "message": "Foo",
                    "contact_email": "test@test.com",
                    "name": "Name Test",
                    "source": "crash report widget",
                }
            }
        }
        assert inst.get_metadata(data) == {
            "message": "Foo",
            "contact_email": "test@test.com",
            "name": "Name Test",
            "source": "crash report widget",
        }
