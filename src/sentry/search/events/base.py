from typing import Callable, List, Mapping, Optional, Set

from django.utils.functional import cached_property
from snuba_sdk.column import Column
from snuba_sdk.function import CurriedFunction, Function
from snuba_sdk.orderby import OrderBy

from sentry.models import Project
from sentry.models.transaction_threshold import (
    TRANSACTION_METRICS,
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
)
from sentry.search.events.constants import (
    DEFAULT_PROJECT_THRESHOLD,
    DEFAULT_PROJECT_THRESHOLD_METRIC,
    ERROR_UNHANDLED_ALIAS,
    ISSUE_ALIAS,
    ISSUE_ID_ALIAS,
    KEY_TRANSACTION_ALIAS,
    PROJECT_ALIAS,
    PROJECT_NAME_ALIAS,
    PROJECT_THRESHOLD_CONFIG_ALIAS,
    PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
    PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
    SNQL_FIELD_ALLOWLIST,
    TEAM_KEY_TRANSACTION_ALIAS,
    TIMESTAMP_TO_DAY_ALIAS,
    TIMESTAMP_TO_HOUR_ALIAS,
    TRANSACTION_STATUS_ALIAS,
    USER_DISPLAY_ALIAS,
)
from sentry.search.events.types import ParamsType, SelectType, WhereType
from sentry.utils.snuba import Dataset, resolve_column


class QueryBase:
    field_allowlist = SNQL_FIELD_ALLOWLIST

    def __init__(self, dataset: Dataset, params: ParamsType):
        self.params = params
        self.dataset = dataset

        # Function is a subclass of CurriedFunction
        self.where: List[WhereType] = []
        self.aggregates: List[CurriedFunction] = []
        self.columns: List[SelectType] = []
        self.orderby: List[OrderBy] = []

        self.projects_to_filter: Set[int] = set()

        self.resolve_column_name = resolve_column(self.dataset)

        self.field_alias_converter: Mapping[str, Callable[[str], SelectType]] = {
            # NOTE: `ISSUE_ALIAS` simply maps to the id, meaning that post processing
            # is required to insert the true issue short id into the response.
            ISSUE_ALIAS: self._resolve_issue_id_alias,
            ISSUE_ID_ALIAS: self._resolve_issue_id_alias,
            PROJECT_ALIAS: self._resolve_project_slug_alias,
            PROJECT_NAME_ALIAS: self._resolve_project_slug_alias,
            TIMESTAMP_TO_HOUR_ALIAS: self._resolve_timestamp_to_hour_alias,
            TIMESTAMP_TO_DAY_ALIAS: self._resolve_timestamp_to_day_alias,
            USER_DISPLAY_ALIAS: self._resolve_user_display_alias,
            TRANSACTION_STATUS_ALIAS: self._resolve_transaction_status,
            PROJECT_THRESHOLD_CONFIG_ALIAS: self._resolve_project_threshold_config,
            # TODO: implement these
            ERROR_UNHANDLED_ALIAS: self._resolve_unimplemented_alias,
            KEY_TRANSACTION_ALIAS: self._resolve_unimplemented_alias,
            TEAM_KEY_TRANSACTION_ALIAS: self._resolve_unimplemented_alias,
        }

    @cached_property
    def project_slugs(self) -> Mapping[str, int]:
        project_ids = self.params.get("project_id", [])

        if len(project_ids) > 0:
            project_slugs = Project.objects.filter(id__in=project_ids)
        else:
            project_slugs = []

        return {p.slug: p.id for p in project_slugs}

    def column(self, name: str) -> Column:
        return Column(self.resolve_column_name(name))

    def is_field_alias(self, alias: str) -> bool:
        return alias in self.field_alias_converter

    def resolve_field_alias(self, alias: str) -> SelectType:
        converter = self.field_alias_converter.get(alias)
        if not converter:
            raise NotImplementedError(f"{alias} not implemented in snql field parsing yet")
        return converter(alias)

    def _resolve_issue_id_alias(self, _: str) -> SelectType:
        """The state of having no issues is represented differently on transactions vs
        other events. On the transactions table, it is represented by 0 whereas it is
        represented by NULL everywhere else. We use coalesce here so we can treat this
        consistently
        """
        return Function("coalesce", [self.column("issue.id"), 0], ISSUE_ID_ALIAS)

    def _resolve_project_slug_alias(self, alias: str) -> SelectType:
        project_ids = {
            project_id
            for project_id in self.params.get("project_id", [])
            if isinstance(project_id, int)
        }

        # Try to reduce the size of the transform by using any existing conditions on projects
        if len(self.projects_to_filter) > 0:
            project_ids &= self.projects_to_filter

        projects = Project.objects.filter(id__in=project_ids).values("slug", "id")

        return Function(
            "transform",
            [
                self.column("project.id"),
                [project["id"] for project in projects],
                [project["slug"] for project in projects],
                "",
            ],
            alias,
        )

    def _resolve_timestamp_to_hour_alias(self, _: str) -> SelectType:
        return Function("toStartOfHour", [self.column("timestamp")], TIMESTAMP_TO_HOUR_ALIAS)

    def _resolve_timestamp_to_day_alias(self, _: str) -> SelectType:
        return Function("toStartOfDay", [self.column("timestamp")], TIMESTAMP_TO_DAY_ALIAS)

    def _resolve_user_display_alias(self, _: str) -> SelectType:
        columns = ["user.email", "user.username", "user.ip"]
        return Function("coalesce", [self.column(column) for column in columns], USER_DISPLAY_ALIAS)

    def _resolve_transaction_status(self, _: str) -> SelectType:
        # TODO: Remove the `toUInt8` once Column supports aliases
        return Function(
            "toUInt8", [self.column(TRANSACTION_STATUS_ALIAS)], TRANSACTION_STATUS_ALIAS
        )

    def _resolve_project_threshold_config(self, _: str) -> SelectType:
        org_id = self.params.get("organization_id")
        project_ids = self.params.get("project_id")

        project_threshold_configs = (
            ProjectTransactionThreshold.objects.filter(
                organization_id=org_id,
                project_id__in=project_ids,
            )
            .order_by("project_id")
            .values("project_id", "threshold", "metric")
        )

        transaction_threshold_configs = (
            ProjectTransactionThresholdOverride.objects.filter(
                organization_id=org_id,
                project_id__in=project_ids,
            )
            .order_by("project_id")
            .values("transaction", "project_id", "threshold", "metric")
        )

        project_threshold_config_index: SelectType = Function(
            "indexOf",
            [
                Function(
                    "array",
                    [
                        Function("toUInt64", [config["project_id"]])
                        for config in project_threshold_configs
                    ],
                ),
                self.column("project_id"),
            ],
            PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
        )

        project_threshold_override_config_index: SelectType = Function(
            "indexOf",
            [
                Function(
                    "array",
                    [
                        Function(
                            "tuple",
                            [
                                Function("toUInt64", [config["project_id"]]),
                                "{}".format(config["transaction"]),
                            ],
                        )
                        for config in transaction_threshold_configs
                    ],
                ),
                Function("tuple", [self.column("project_id"), self.column("transaction")]),
            ],
            PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
        )

        def project_threshold_config(alias: Optional[str] = None) -> SelectType:
            return (
                Function(
                    "if",
                    [
                        Function(
                            "equals",
                            [
                                project_threshold_config_index,
                                0,
                            ],
                        ),
                        Function(
                            "tuple",
                            [f"{DEFAULT_PROJECT_THRESHOLD_METRIC}", DEFAULT_PROJECT_THRESHOLD],
                        ),
                        Function(
                            "arrayElement",
                            [
                                Function(
                                    "array",
                                    [
                                        Function(
                                            "tuple",
                                            [
                                                "{}".format(TRANSACTION_METRICS[config["metric"]]),
                                                config["threshold"],
                                            ],
                                        )
                                        for config in project_threshold_configs
                                    ],
                                ),
                                project_threshold_config_index,
                            ],
                        ),
                    ],
                    alias,
                )
                if project_threshold_configs
                else Function(
                    "tuple",
                    [f"{DEFAULT_PROJECT_THRESHOLD_METRIC}", DEFAULT_PROJECT_THRESHOLD],
                    alias,
                )
            )

        if transaction_threshold_configs:
            return Function(
                "if",
                [
                    Function(
                        "equals",
                        [
                            project_threshold_override_config_index,
                            0,
                        ],
                    ),
                    project_threshold_config(),
                    Function(
                        "arrayElement",
                        [
                            Function(
                                "array",
                                [
                                    Function(
                                        "tuple",
                                        [
                                            "{}".format(TRANSACTION_METRICS[config["metric"]]),
                                            config["threshold"],
                                        ],
                                    )
                                    for config in transaction_threshold_configs
                                ],
                            ),
                            project_threshold_override_config_index,
                        ],
                    ),
                ],
                PROJECT_THRESHOLD_CONFIG_ALIAS,
            )

        return project_threshold_config(PROJECT_THRESHOLD_CONFIG_ALIAS)

    def _resolve_unimplemented_alias(self, alias: str) -> SelectType:
        """Used in the interim as a stub for ones that have not be implemented in SnQL yet.
        Can be deleted once all field aliases have been implemented.
        """
        raise NotImplementedError(f"{alias} not implemented in snql field parsing yet")
