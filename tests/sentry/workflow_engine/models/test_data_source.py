from unittest import mock

import pytest

from sentry.workflow_engine.registry import data_source_type_registry
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DataSourceTest(BaseWorkflowTest):
    def test_invalid_data_source_type(self):
        with pytest.raises(ValueError):
            self.create_data_source(type="invalid_type")

    def test_data_source_valid_type(self):
        # Make sure the mock was registered in test_base
        assert isinstance(data_source_type_registry.get("test"), mock.Mock)

        data_source = self.create_data_source(type="test")
        assert data_source is not None
        assert data_source.type == "test"
