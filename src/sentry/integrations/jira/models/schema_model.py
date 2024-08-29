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
    type: str
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
    def from_dict(cls, data: dict[str, Any]) -> "JiraSchema":
        mapped_field_params = {
            new_name: data.get(new_name)
            for old_name, new_name in cls.__jira_schema_parameter_map
            if old_name in data
        }

        return cls(**mapped_field_params)

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

    __jira_field_parameter_map = frozenset(
        [
            ("required", "required"),
            ("name", "name"),
            ("key", "key"),
            ("operations", "operations"),
            ("hasDefaultValue", "has_default_value"),
        ]
    )

    def is_custom_field(self) -> bool:
        return self.schema.custom is not None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "JiraField":
        mapped_field_params = {
            new_name: data.get(new_name)
            for old_name, new_name in cls.__jira_field_parameter_map
            if old_name in data
        }

        mapped_field_params["schema"] = JiraSchema.from_dict(data["schema"])

        return cls(**mapped_field_params)

    @classmethod
    def from_dict_list(cls, data: dict[dict[str, Any]]) -> list["JiraField"]:
        return [cls.from_dict(item) for item in data.values()]


jira_issue_mapped_fields = {
    "id": "id",
    "description": "description",
    "name": "name",
    "subtask": "subtask",
    "iconUrl": "icon_url",
    "self": "url",
}


@dataclass(frozen=True)
class JiraIssueTypeMetadata:
    id: str
    description: str
    name: str
    subtask: bool
    icon_url: str
    url: str
    fields: list[JiraField]
    __jira_issue_mapped_fields = frozenset(
        [
            ("id", "id"),
            ("description", "description"),
            ("name", "name"),
            ("subtask", "subtask"),
            ("iconUrl", "icon_url"),
            ("self", "url"),
        ]
    )

    @classmethod
    def from_jira_meta_config(cls, meta_config: dict[str, Any]) -> list["JiraIssueTypeMetadata"]:
        issue_configs = []
        issue_types_list = meta_config.get("issuetypes", {})

        for issue_config in issue_types_list:
            # Create a shallow copy of the config meta, without the "self" property,
            # which we need to rename.
            meta_config_clone = {
                np: issue_config.get(op)
                for op, np in cls.__jira_issue_mapped_fields
                if op in issue_config
            }

            meta_config_clone["fields"] = []
            if (fields := issue_config.get("fields")) is not None:
                meta_config_clone["fields"] = JiraField.from_dict_list(fields)

            issue_configs.append(cls(**meta_config_clone))

        return issue_configs
