from sentry.sentry_apps.api.serializers.response_schemas import (
    alert_rule_settings_schema,
    component_schema,
)


def test_component_schemas_are_fully_described() -> None:
    # Raises UndescribedPropertyError when the UI component schema gains a property
    # that the descriptions in response_schemas don't cover.
    assert component_schema()["anyOf"]
    settings = alert_rule_settings_schema()
    select = settings["properties"]["required_fields"]["items"]["anyOf"][0]
    assert {"choices", "defaultValue"} <= set(select["properties"])
