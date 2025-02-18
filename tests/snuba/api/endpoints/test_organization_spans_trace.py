from uuid import uuid4

from django.urls import reverse

from tests.snuba.api.endpoints.test_organization_events_trace import (
    OrganizationEventsTraceEndpointBase,
)


class OrganizationEventsTraceEndpointTest(OrganizationEventsTraceEndpointBase):
    url_name = "sentry-api-0-organization-spans-trace"
    FEATURES = ["organizations:trace-spans-format"]

    def assert_event(self, result, event_data, message):
        assert result["transaction"] == event_data.transaction, message
        assert result["event_id"] == event_data.data["contexts"]["trace"]["span_id"], message
        assert result["start_timestamp"] == event_data.data["start_timestamp"], message

    def get_transaction_children(self, event):
        """Assumes that the test setup only gives each event 1 txn child"""
        children = []
        for child in event["children"]:
            if child["is_transaction"]:
                children.append(child)
            else:
                children.extend(child["children"])
        return sorted(children, key=lambda event: event["description"])

    def assert_trace_data(self, root, gen2_no_children=True):
        """see the setUp docstring for an idea of what the response structure looks like"""
        self.assert_event(root, self.root_event, "root")
        assert root["parent_span_id"] is None
        assert root["duration"] == 3000
        # 3 transactions, 2 child spans
        assert len(root["children"]) == 5
        transaction_children = self.get_transaction_children(root)
        assert len(transaction_children) == 3
        self.assert_performance_issues(root)

        for i, gen1 in enumerate(transaction_children):
            self.assert_event(gen1, self.gen1_events[i], f"gen1_{i}")
            assert gen1["parent_span_id"] == self.root_span_ids[i]
            assert gen1["duration"] == 2000
            assert len(gen1["children"]) == 1

            gen2 = self.get_transaction_children(gen1)[0]
            self.assert_event(gen2, self.gen2_events[i], f"gen2_{i}")
            assert gen2["parent_span_id"] == self.gen1_span_ids[i]
            assert gen2["duration"] == 1000

            # Only the first gen2 descendent has a child
            if i == 0:
                assert len(gen2["children"]) == 4
                gen3 = self.get_transaction_children(gen2)[0]
                self.assert_event(gen3, self.gen3_event, f"gen3_{i}")
                assert gen3["parent_span_id"] == self.gen2_span_id
                assert gen3["duration"] == 500
                assert len(gen3["children"]) == 0
            elif gen2_no_children:
                assert len(gen2["children"]) == 0

    def assert_performance_issues(self, root):
        """Broken in the non-spans endpoint, but we're not maintaining that anymore"""

    def client_get(self, data, url=None):
        if url is None:
            url = self.url
        return self.client.get(
            url,
            data,
            format="json",
        )

    def test_no_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        url = reverse(
            self.url_name,
            kwargs={"organization_id_or_slug": org.slug, "trace_id": uuid4().hex},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                url,
                format="json",
            )

        assert response.status_code == 404, response.content

    def test_simple(self):
        self.load_trace()
        with self.feature(self.FEATURES):
            response = self.client_get(
                data={"project": -1},
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        self.assert_trace_data(data[0])
