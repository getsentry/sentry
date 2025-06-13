from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.nodestore.filestore.backend import FilestoreNodeStorage
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
class TestFilestoreNodeStorage:

    def setup_method(self):
        self.ns = FilestoreNodeStorage()

    def test_set_and_get(self):
        id = "d2502ebbd7df41ceba8d3275595cac33"
        data = {"foo": "bar"}
        self.ns.set(id, data)
        result = self.ns.get(id=id)
        assert result == data

    def test_get_not_exist(self):
        with pytest.raises(FileNotFoundError):
            self.ns.get("not_exist_123")

    def test_set_and_get_multi(self):
        self.ns.set("d2502ebbd7df41ceba8d3275595cac33", {"foo": "bar"})
        self.ns.set("5394aa025b8e401ca6bc3ddee3130edc", {"foo": "baz"})

        result = self.ns.get_multi(
            ["d2502ebbd7df41ceba8d3275595cac33", "5394aa025b8e401ca6bc3ddee3130edc"]
        )
        assert result == {
            "d2502ebbd7df41ceba8d3275595cac33": {"foo": "bar"},
            "5394aa025b8e401ca6bc3ddee3130edc": {"foo": "baz"},
        }

    def test_set_and_delete(self):
        self.ns.set("d2502ebbd7df41ceba8d3275595cac33", {"foo": "bar"})
        self.ns.delete("d2502ebbd7df41ceba8d3275595cac33")
        result = self.ns.get(id="d2502ebbd7df41ceba8d3275595cac33")

        # It seems the default Filestore does not delete file immediately, is this expected?
        assert result == {"foo": "bar"}

    def test_cleanup(self):
        now = timezone.now()
        cutoff = now - timedelta(days=1)
        with pytest.raises(NotImplementedError):
            self.ns.cleanup(cutoff)
