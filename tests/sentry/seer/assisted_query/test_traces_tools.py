from unittest.mock import MagicMock, patch

from sentry.seer.assisted_query.traces_tools import get_attribute_names
from sentry.testutils.cases import TestCase


def _attribute(name, attr_type="string", source="user", context=None):
    attribute = {
        "key": name,
        "name": name,
        "attributeType": attr_type,
        "attributeSource": {"source_type": source},
    }
    if context is not None:
        attribute["context"] = context
    return attribute


class TestGetAttributeNames(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)

    def _mock_responses(self, mock_client_cls, string_attrs, number_attrs=None):
        """Stub the two per-type calls get_attribute_names makes (string, then number)."""
        mock_client = mock_client_cls.return_value
        string_response, number_response = MagicMock(), MagicMock()
        string_response.data = string_attrs
        number_response.data = number_attrs or []
        mock_client.get.side_effect = [string_response, number_response]
        return mock_client

    @patch("sentry.seer.assisted_query.traces_tools.ApiClient")
    def test_custom_context_goes_to_custom_fields(self, mock_client_cls: MagicMock) -> None:
        self._mock_responses(
            mock_client_cls,
            [
                # A convention, which belongs in built_in_fields.
                _attribute(
                    "device.class",
                    context={"isConvention": True, "brief": "Device class"},
                ),
                # User-authored context, which belongs in custom_fields.
                _attribute(
                    "my_custom_attr",
                    context={
                        "isCustom": True,
                        "brief": "Set by the checkout service",
                        "details": ["Only on payment spans."],
                        "examples": ["visa"],
                    },
                ),
                # No context at all, so it appears only in `fields`.
                _attribute("undescribed_attr", context={}),
            ],
        )

        result = get_attribute_names(
            org_id=self.org.id,
            project_ids=[self.project.id],
            stats_period="7d",
            include_context=True,
        )

        assert [field.key for field in result.custom_fields] == ["my_custom_attr"]
        assert result.custom_fields[0].type == "string"
        assert result.custom_fields[0].context == {
            "isCustom": True,
            "brief": "Set by the checkout service",
            "details": ["Only on payment spans."],
            "examples": ["visa"],
        }

        built_in_keys = {field.key for field in result.built_in_fields}
        assert "device.class" in built_in_keys
        # Custom context must never leak into the Sentry-owned fields.
        assert "my_custom_attr" not in built_in_keys
        assert "undescribed_attr" not in built_in_keys

        # Every attribute is still listed in `fields`, with or without context.
        assert result.fields["string"] == [
            "device.class",
            "my_custom_attr",
            "undescribed_attr",
        ]

    @patch("sentry.seer.assisted_query.traces_tools.ApiClient")
    def test_number_typed_custom_context(self, mock_client_cls: MagicMock) -> None:
        self._mock_responses(
            mock_client_cls,
            [],
            [_attribute("cart_total", "number", context={"isCustom": True, "brief": "In cents"})],
        )

        result = get_attribute_names(
            org_id=self.org.id,
            project_ids=[self.project.id],
            stats_period="7d",
            include_context=True,
        )

        assert len(result.custom_fields) == 1
        assert result.custom_fields[0].key == "cart_total"
        assert result.custom_fields[0].type == "number"

    @patch("sentry.seer.assisted_query.traces_tools.ApiClient")
    def test_sentry_source_attribute_stays_built_in(self, mock_client_cls: MagicMock) -> None:
        # A Sentry-defined attribute carries isConvention=False, so it is routed by
        # its `sentry` source rather than being mistaken for custom context.
        self._mock_responses(
            mock_client_cls,
            [
                _attribute(
                    "span.description",
                    source="sentry",
                    context={"isConvention": False, "brief": "Span description"},
                )
            ],
        )

        result = get_attribute_names(
            org_id=self.org.id,
            project_ids=[self.project.id],
            stats_period="7d",
            include_context=True,
        )

        assert "span.description" in {field.key for field in result.built_in_fields}
        assert result.custom_fields == []

    @patch("sentry.seer.assisted_query.traces_tools.ApiClient")
    def test_no_context_requested(self, mock_client_cls: MagicMock) -> None:
        mock_client = self._mock_responses(mock_client_cls, [_attribute("my_custom_attr")])

        result = get_attribute_names(
            org_id=self.org.id,
            project_ids=[self.project.id],
            stats_period="7d",
        )

        assert result.custom_fields == []
        # Context is only requested from the endpoint when asked for.
        _args, kwargs = mock_client.get.call_args
        assert "expand" not in kwargs["params"]
