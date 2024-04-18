from collections.abc import Mapping, Sequence

from snuba_sdk import BooleanCondition, BooleanOp, Column, Condition, Op

from sentry.api.serializers import bulk_fetch_project_latest_releases
from sentry.models.project import Project
from sentry.sentry_metrics.querying.data.mapping.mapper import Mapper, MapperConfig
from sentry.sentry_metrics.querying.errors import LatestReleaseNotFoundError
from sentry.sentry_metrics.querying.types import QueryCondition
from sentry.sentry_metrics.querying.visitors.base import QueryConditionVisitor


class LatestReleaseTransformationVisitor(QueryConditionVisitor[QueryCondition]):
    """
    Visitor that recursively transforms all the conditions in the form `release:latest` by transforming them to
    `release IN [x, y, ...]` where `x` and `y` are the latest releases belonging to the supplied projects.
    """

    def __init__(self, projects: Sequence[Project]):
        self._projects = projects

    def _visit_condition(self, condition: Condition) -> QueryCondition:
        if not isinstance(condition.lhs, Column):
            return condition

        if not (
            condition.lhs.name == "release"
            and isinstance(condition.rhs, str)
            and condition.rhs == "latest"
        ):
            return condition

        latest_releases = bulk_fetch_project_latest_releases(self._projects)
        if not latest_releases:
            raise LatestReleaseNotFoundError(
                "Latest release(s) not found for the supplied projects"
            )

        return Condition(
            lhs=condition.lhs,
            op=Op.IN,
            rhs=[latest_release.version for latest_release in latest_releases],
        )


class TagsTransformationVisitor(QueryConditionVisitor[QueryCondition]):
    """
    Visitor that recursively transforms all conditions to work on tags in the form `tags[x]`.
    """

    def __init__(self, check_sentry_tags: bool):
        self._check_sentry_tags = check_sentry_tags

    def _visit_condition(self, condition: Condition) -> QueryCondition:
        if not isinstance(condition.lhs, Column):
            return condition

        # We assume that all incoming conditions are on tags, since we do not allow filtering by project in the
        # query filters.
        tag_column = f"tags[{condition.lhs.name}]"
        sentry_tag_column = f"sentry_tags[{condition.lhs.name}]"

        if self._check_sentry_tags:
            tag_column = f"tags[{condition.lhs.name}]"
            # We might have tags across multiple nested structures such as `tags` and `sentry_tags` for this reason
            # we want to emit a condition that spans both.
            return BooleanCondition(
                op=BooleanOp.OR,
                conditions=[
                    Condition(lhs=Column(name=tag_column), op=condition.op, rhs=condition.rhs),
                    Condition(
                        lhs=Column(name=sentry_tag_column),
                        op=condition.op,
                        rhs=condition.rhs,
                    ),
                ],
            )
        else:
            return Condition(lhs=Column(name=tag_column), op=condition.op, rhs=condition.rhs)


class MappingTransformationVisitor(QueryConditionVisitor[QueryCondition]):
    """
    Visitor that recursively transforms all conditions whose `key` matches one of the supplied mappings. If found,
    replaces it with the mapped value.
    """

    def __init__(self, mappings: Mapping[str, str]):
        self._mappings = mappings

    def _visit_condition(self, condition: Condition) -> QueryCondition:
        if not isinstance(condition.lhs, Column):
            return condition

        return Condition(
            lhs=Column(name=self._mappings.get(condition.lhs.key, condition.lhs.name)),
            op=condition.op,
            rhs=condition.rhs,
        )


class MapperConditionVisitor(QueryConditionVisitor):
    def __init__(self, projects: Sequence[Project], mapper_config: MapperConfig):
        self.projects = projects
        self.mapper_config = mapper_config
        self.mappers: list[Mapper] = []

    def get_or_create_mapper(
        self, from_key: str | None = None, to_key: int | None = None
    ) -> Mapper | None:
        # retrieve the mapper type that is applicable for the given key
        mapper_class = self.mapper_config.get(from_key=from_key, to_key=to_key)
        # check if a mapper of the type already exists
        if mapper_class:
            for mapper in self.mappers:
                if mapper_class == type(mapper):
                    # if a mapper already exists, return the existing mapper
                    return mapper
            else:
                # if no mapper exists yet, instantiate the object and append it to the mappers list
                mapper_instance = mapper_class()
                self.mappers.append(mapper_instance)
                return mapper_instance
        else:
            # if no mapper is configured for the key, return None
            return None

    def _visit_condition(self, condition: Condition) -> Condition:
        lhs = condition.lhs
        rhs = condition.rhs

        if isinstance(lhs, Column):
            mapper = self.get_or_create_mapper(from_key=lhs.name)
            if mapper:
                new_lhs = Column(mapper.to_key)
                if isinstance(rhs, list):
                    new_rhs = [mapper.forward(self.projects, element) for element in rhs]
                else:
                    new_rhs = mapper.forward(self.projects, rhs)

                return Condition(lhs=new_lhs, op=condition.op, rhs=new_rhs)

        return condition

    def _visit_boolean_condition(self, boolean_condition: BooleanCondition) -> BooleanCondition:
        conditions = []
        for condition in boolean_condition.conditions:
            conditions.append(self.visit(condition))

        return BooleanCondition(op=boolean_condition.op, conditions=conditions)
