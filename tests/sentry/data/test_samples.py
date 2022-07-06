import os

import pytest

from sentry.constants import DATA_ROOT
from sentry.utils import json


@pytest.mark.parametrize("filename", os.listdir(os.path.join(DATA_ROOT, "samples")))
def test_is_valid_json(filename):
    with open(os.path.join(DATA_ROOT, "samples", filename)) as f:
        json.loads(f.read())
