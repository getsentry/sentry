from django.urls import reverse

from sentry.testutils.cases import APITestCase


class OrganizationAttributeMappingsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-attribute-mappings"

    def test_get_all_mappings(self):
        """Test that endpoint returns all attribute mappings when no filter is provided."""
        self.login_as(user=self.user)
        url = reverse(self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug})
        response = self.client.get(url)

        assert response.status_code == 200
        response_data = response.json()
        assert "data" in response_data
        data = response_data["data"]
        assert isinstance(data, list)
        assert len(data) > 0

        # Check all 6 types are present
        types_present = {item["type"] for item in data}
        expected_types = {"spans", "logs", "occurrences", "metrics", "uptime_results", "profiles"}
        assert types_present == expected_types

        # Check each item has required keys
        for item in data:
            assert "type" in item
            assert "publicAlias" in item
            assert "internalName" in item
            assert "searchType" in item

    def test_known_span_mapping(self):
        """Test that a known span mapping is returned correctly."""
        self.login_as(user=self.user)
        url = reverse(self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug})
        response = self.client.get(url, {"type": "spans"})

        assert response.status_code == 200
        data = response.json()["data"]

        # Find the 'id' mapping for spans
        id_mapping = next(
            (item for item in data if item["publicAlias"] == "id" and item["type"] == "spans"),
            None,
        )
        assert id_mapping is not None
        assert id_mapping["internalName"] == "sentry.item_id"
        assert id_mapping["searchType"] == "string"

    def test_known_log_mapping(self):
        """Test that a known log mapping is returned correctly."""
        self.login_as(user=self.user)
        url = reverse(self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug})
        response = self.client.get(url, {"type": "logs"})

        assert response.status_code == 200
        data = response.json()["data"]

        # Find the 'message' mapping for logs
        message_mapping = next(
            (item for item in data if item["publicAlias"] == "message" and item["type"] == "logs"),
            None,
        )
        assert message_mapping is not None
        assert message_mapping["internalName"] == "sentry.body"
        assert message_mapping["searchType"] == "string"

    def test_single_type_filter(self):
        """Test filtering by a single type."""
        self.login_as(user=self.user)
        url = reverse(self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug})
        response = self.client.get(url, {"type": "spans"})

        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) > 0

        # All items should be spans
        for item in data:
            assert item["type"] == "spans"

    def test_multiple_type_filter(self):
        """Test filtering by multiple types using repeated query params."""
        self.login_as(user=self.user)
        url = reverse(self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug})
        response = self.client.get(url, {"type": ["spans", "logs"]})

        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) > 0

        # All items should be either spans or logs
        types_present = {item["type"] for item in data}
        assert types_present == {"spans", "logs"}

    def test_invalid_type_returns_400(self):
        """Test that an invalid type returns a 400 error."""
        self.login_as(user=self.user)
        url = reverse(self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug})
        response = self.client.get(url, {"type": "invalid_type"})

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "invalid_type" in data["detail"]

    def test_mixed_valid_invalid_types_returns_400(self):
        """Test that mixing valid and invalid types returns a 400 error."""
        self.login_as(user=self.user)
        url = reverse(self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug})
        response = self.client.get(url, {"type": ["spans", "invalid_type"]})

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "invalid_type" in data["detail"]

    def test_includes_secondary_aliases(self):
        """Test that secondary aliases are included in the response."""
        self.login_as(user=self.user)
        url = reverse(self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug})
        response = self.client.get(url, {"type": "spans"})

        assert response.status_code == 200
        data = response.json()["data"]

        # Find a known secondary alias (description maps to sentry.raw_description)
        description_mapping = next(
            (
                item
                for item in data
                if item["publicAlias"] == "description" and item["type"] == "spans"
            ),
            None,
        )
        assert description_mapping is not None
        assert description_mapping["internalName"] == "sentry.raw_description"

    def test_camelcase_keys(self):
        """Test that response uses camelCase keys."""
        self.login_as(user=self.user)
        url = reverse(self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug})
        response = self.client.get(url, {"type": "spans"})

        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) > 0

        item = data[0]
        assert "publicAlias" in item
        assert "internalName" in item
        assert "searchType" in item
        # These should not be present (snake_case)
        assert "public_alias" not in item
        assert "internal_name" not in item
        assert "search_type" not in item

    def test_excludes_private_attributes(self):
        """Test that private attributes are not included in the response."""
        self.login_as(user=self.user)
        url = reverse(self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug})
        response = self.client.get(url, {"type": ["spans", "logs"]})

        assert response.status_code == 200
        data = response.json()["data"]

        # sentry.links is a known private attribute in spans
        links_mapping = next(
            (
                item
                for item in data
                if item["publicAlias"] == "sentry.links" and item["type"] == "spans"
            ),
            None,
        )
        assert links_mapping is None

        # sentry.item_type is a private attribute in common columns (used by logs)
        item_type_mapping = next(
            (
                item
                for item in data
                if item["publicAlias"] == "sentry.item_type" and item["type"] == "logs"
            ),
            None,
        )
        assert item_type_mapping is None

    def test_duplicate_type_parameters_deduplicated(self):
        """Test that duplicate type parameters are deduplicated."""
        self.login_as(user=self.user)
        url = reverse(self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug})

        # Request with duplicate type parameter
        response = self.client.get(url + "?type=spans&type=spans")

        assert response.status_code == 200
        data = response.json()["data"]

        # Count occurrences of each publicAlias for spans
        span_items = [item for item in data if item["type"] == "spans"]
        public_aliases = [item["publicAlias"] for item in span_items]

        # Each publicAlias should appear exactly once
        assert len(public_aliases) == len(set(public_aliases))

        # Compare with single type request to ensure same count
        response_single = self.client.get(url, {"type": "spans"})
        assert response_single.status_code == 200
        data_single = response_single.json()["data"]
        span_items_single = [item for item in data_single if item["type"] == "spans"]

        assert len(span_items) == len(span_items_single)
