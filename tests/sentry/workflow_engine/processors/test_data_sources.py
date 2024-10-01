from sentry.workflow_engine.processors import process_data_sources


class TestProcessDataSources:
    def test_no_data_sources_provided(self):
        assert process_data_sources([]) == []
