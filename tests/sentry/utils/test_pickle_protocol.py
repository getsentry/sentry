import pickle
from pickle import PickleBuffer, PickleError

import pytest

from sentry.testutils.cases import TestCase


class PickleProtocolTestCase(TestCase):
    """
    At the time of adding this test we still monkey patch `pickle` and hardcode the protocol to be 2.
    For legacy reasons see `src/sentry/monkey/pickle.py`.

    This test is for a change that's being made to allow explicitly passing a newer protocol to
    pickle. If we remove the monkey patching to pickle there is no longer a need for this test.

    """

    def test_pickle_protocol(self):
        data = b"iamsomedata"

        pickled_data = PickleBuffer(data)
        with pytest.raises(PickleError) as excinfo:
            result = pickle.dumps(pickled_data)

        assert "PickleBuffer can only pickled with protocol >= 5" == str(excinfo.value)

        result = pickle.dumps(pickled_data, protocol=5)
        assert result
