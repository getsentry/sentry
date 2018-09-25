from __future__ import absolute_import

import pytest

from sentry.db.exceptions import DuplicateKeyError
from sentry.testutils import TestCase


class ErrorHandlingTesting(TestCase):
    def test_duplicate_key(self):
        user = self.create_user('foo@example.com')

        with pytest.raises(DuplicateKeyError):
            self.create_user(user.username)
