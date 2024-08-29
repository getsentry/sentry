from dataclasses import dataclass
from enum import Enum
from typing import Any


class JiraSchemaTypes(str, Enum):
    string = "string"
    option = "option"
    array = "array"
    user = "user"
    issue_type = "issuetype"
    issue_link = "issuelink"
    project = "project"
    date = "date"
    team = "team"
    number = "number"
    any = "any"


@dataclass(frozen=True)
class JiraSchema:
    schema_type: str
    """
    The Field type. Possible types include:
    - string
    - array (has a corresponding `items` field with its subtype)
    - user
    - issuetype
    - issuelink
    - project (and PROJECT)
    - date
    - team
    - any
    """
    custom: str | None = None
    """
    The very long custom field name corresponding to some namespace, plugin,
    and custom field name.
    """
    custom_id: str | None = None
    """
    A unique identifier for a field on an issue, in the form of 'customfield_<int>'
    """
    system: str | None = None
    """
    TODO(Gabe): Figure out what this is used for
    """
    items: str | None = None
    """
    Specifies the subtype for aggregate type, such as `array`. For any
    non-aggregate types, this will be None
    """

    __jira_schema_parameter_map = frozenset(
        [
            ("type", "type"),
            ("custom", "custom"),
            ("custom_id", "custom_id"),
            ("system", "system"),
            ("items", "items"),
        ]
    )

    @classmethod
    def from_dict(cls, data: dict[str, Any | None]) -> "JiraSchema":
        schema_type = data.get("type")
        custom = data.get("custom")
        custom_id = data.get("custom_id")
        system = data.get("system")
        items = data.get("items")

        return cls(
            schema_type=schema_type, custom=custom, custom_id=custom_id, system=system, items=items
        )

    @classmethod
    def from_dict_list(cls, data: list[dict[str, Any]]) -> list["JiraSchema"]:
        return [cls.from_dict(item) for item in data]


@dataclass(frozen=True)
class JiraField:
    """
    Represents a Jira Issue Field, which is queried directly via Jira's issue
    creation metadata API:
    https://developer.atlassian.com/server/jira/platform/rest/v10000/api-group-issue/#api-api-2-issue-createmeta-projectidorkey-issuetypes-issuetypeid-get
    """

    required: bool
    schema: JiraSchema
    name: str
    key: str
    operations: list[str]
    has_default_value: bool = False

    def is_custom_field(self) -> bool:
        return self.schema.custom is not None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "JiraField":
        required = data.get("required")
        name = data.get("name")
        key = data.get("key")
        operations = data.get("operations")
        has_default_value = data.get("hasDefaultValue")
        raw_schema = data.get("schema")

        schema = JiraSchema.from_dict(raw_schema)

        return cls(
            required=required,
            name=name,
            key=key,
            schema=schema,
            operations=operations,
            has_default_value=has_default_value,
        )

    @classmethod
    def from_dict_list(cls, data: dict[str, dict[str, Any]]) -> list["JiraField"]:
        return [cls.from_dict(item) for item in data.values()]


@dataclass(frozen=True)
class JiraIssueTypeMetadata:
    id: str
    description: str
    name: str
    subtask: bool
    icon_url: str
    url: str
    fields: list[JiraField]

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "JiraIssueTypeMetadata":
        jira_id = data.get("id")
        description = data.get("description")
        name = data.get("name")
        subtask = data.get("subtask")
        icon_url = data.get("iconUrl")
        url = data.get("self")
        raw_fields = data.get("fields")

        fields = JiraField.from_dict_list(raw_fields)

        return cls(
            id=jira_id,
            name=name,
            description=description,
            subtask=subtask,
            icon_url=icon_url,
            url=url,
            fields=fields,
        )

    @classmethod
    def from_jira_meta_config(cls, meta_config: dict[str, Any]) -> list["JiraIssueTypeMetadata"]:
        issue_types_list = meta_config.get("issuetypes", {})
        issue_configs = [cls.from_dict(it) for it in issue_types_list]

        return issue_configs
