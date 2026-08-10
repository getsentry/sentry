from __future__ import annotations

from typing import Any

from django.db import IntegrityError, router, transaction
from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.investigations.agent import (
    interrupt_run,
    start_execution_run,
    synchronize_execution,
    synchronize_title,
)
from sentry.investigations.endpoints.serializers import (
    InvestigationBlockSerializer,
    InvestigationDetailsSerializer,
    InvestigationSerializer,
)
from sentry.investigations.endpoints.validators import (
    BlockCreateValidator,
    BlockDeleteValidator,
    BlockExecutionStartValidator,
    BlockOrderValidator,
    BlockUpdateValidator,
    FavoriteUpdateValidator,
    InvestigationCreateValidator,
    InvestigationDeleteValidator,
    InvestigationUpdateValidator,
    ParameterValuesValidator,
    PermissionsUpdateValidator,
)
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationBlockKind,
    InvestigationFavoriteUser,
    InvestigationPermissions,
    InvestigationSourceType,
    InvestigationStatus,
)
from sentry.investigations.permissions import (
    InvestigationPermission,
    is_organization_manager,
)
from sentry.investigations.services import (
    InvestigationConflictError,
    InvestigationSourceNotFound,
    InvestigationValidationError,
    archive_investigation,
    create_block,
    create_block_execution,
    create_manual_investigation,
    create_template_investigation,
    delete_block,
    duplicate_investigation,
    mark_block_execution_dispatch_failed,
    reorder_blocks,
    update_block,
    update_investigation,
    update_parameter_values,
    update_permissions,
)
from sentry.investigations.services.auto_run import schedule_eligible_auto_run_blocks
from sentry.investigations.services.breached_metrics import resolve_breached_metric_sources
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_utils import AgentUpdateRequest, make_agent_update_request
from sentry.utils import metrics

FEATURE = "organizations:investigations"
QUERY_EXECUTION_FEATURE = "organizations:investigations-query-execution"


def _feature_enabled(request: Request, organization: Organization) -> bool:
    return features.has(FEATURE, organization, actor=request.user)


def _query_execution_enabled(request: Request, organization: Organization) -> bool:
    return features.has(QUERY_EXECUTION_FEATURE, organization, actor=request.user)


def _require_breached_metric_feature(request: Request, organization: Organization) -> None:
    if not _feature_enabled(request, organization) or not _query_execution_enabled(
        request, organization
    ):
        raise ResourceDoesNotExist


def _parse_group_ids(value: Any) -> list[int] | None:
    if not isinstance(value, list) or not 1 <= len(value) <= 100:
        return None
    parsed: list[int] = []
    for item in value:
        if isinstance(item, bool) or not isinstance(item, int | str):
            return None
        try:
            parsed.append(int(item))
        except (TypeError, ValueError):
            return None
    return list(dict.fromkeys(parsed))


def _service_error(error: Exception) -> Response | None:
    if isinstance(error, InvestigationValidationError):
        return Response(error.errors, status=status.HTTP_400_BAD_REQUEST)
    if isinstance(error, InvestigationConflictError):
        return Response({"detail": str(error)}, status=status.HTTP_409_CONFLICT)
    if isinstance(error, InvestigationSourceNotFound):
        raise ResourceDoesNotExist
    return None


def _accessible_project_ids(
    endpoint: OrganizationEndpoint, request: Request, organization: Organization
) -> set[int]:
    return {project.id for project in endpoint.get_projects(request, organization)}


def _required_investigation_project_ids(investigation: Investigation) -> set[int]:
    selected = set(investigation.projects.values_list("id", flat=True))
    visible_execution_ids: set[int] = set()
    for result_execution_id, content_execution_id in InvestigationBlock.objects.filter(
        investigation=investigation, deleted_at__isnull=True
    ).values_list("result_execution_id", "content_execution_id"):
        if result_execution_id is not None:
            visible_execution_ids.add(result_execution_id)
        if content_execution_id is not None:
            visible_execution_ids.add(content_execution_id)
    represented = set(
        Project.objects.filter(
            investigationblockexecutionproject__execution_id__in=visible_execution_ids,
        ).values_list("id", flat=True)
    )
    return selected | represented


def _user_id(request: Request) -> int:
    user_id = request.user.id
    if user_id is None:
        raise PermissionDenied
    return user_id


def _require_authenticated_user(request: Request) -> int:
    if not request.user.is_authenticated or request.user.is_sentry_app:
        raise PermissionDenied
    return _user_id(request)


def _require_manager_or_creator(
    request: Request, organization: Organization, investigation: Investigation
) -> None:
    if _user_id(request) == investigation.created_by_id:
        return
    if is_organization_manager(request, organization):
        return
    raise PermissionDenied


def _can_edit(request: Request, organization: Organization, investigation: Investigation) -> bool:
    return is_organization_manager(
        request, organization
    ) or investigation.permissions.has_edit_permissions(_user_id(request))


def _can_manage(request: Request, organization: Organization, investigation: Investigation) -> bool:
    return _user_id(request) == investigation.created_by_id or is_organization_manager(
        request, organization
    )


def _serialize_permissions(
    investigation: Investigation,
    *,
    user_id: int,
    can_edit: bool,
    can_manage: bool,
) -> dict[str, Any]:
    permissions, _ = InvestigationPermissions.objects.get_or_create(investigation=investigation)
    return {
        "isEditableByEveryone": permissions.is_editable_by_everyone,
        "teamIds": sorted(permissions.teams_with_edit_access.values_list("id", flat=True)),
        "canEdit": can_edit,
        "canManage": can_manage,
    }


def _serialize_investigation(
    investigation: Investigation,
    request: Request,
    organization: Organization,
    *,
    detailed: bool,
    accessible_project_ids: set[int] | None = None,
) -> dict[str, Any]:
    serializer = (
        InvestigationDetailsSerializer(accessible_project_ids=accessible_project_ids or set())
        if detailed
        else InvestigationSerializer()
    )
    data = dict(serialize(investigation, request.user, serializer))
    data["permissions"] = _serialize_permissions(
        investigation,
        user_id=_user_id(request),
        can_edit=_can_edit(request, organization, investigation),
        can_manage=_can_manage(request, organization, investigation),
    )
    return data


def _serialize_block(
    block: InvestigationBlock,
    request: Request,
    accessible_project_ids: set[int],
) -> dict[str, Any]:
    return dict(
        serialize(
            block,
            request.user,
            InvestigationBlockSerializer(accessible_project_ids=accessible_project_ids),
        )
    )


class OrganizationInvestigationBase(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    permission_classes = (InvestigationPermission,)
    prefetch_permission_teams = False

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        investigation_id: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)
        organization = kwargs["organization"]
        if not _feature_enabled(request, organization):
            raise ResourceDoesNotExist
        try:
            queryset = Investigation.objects.select_related("organization", "permissions")
            if self.prefetch_permission_teams and request.method == "GET":
                queryset = queryset.prefetch_related("permissions__teams_with_edit_access")
            investigation = queryset.get(id=investigation_id, organization=organization)
        except (Investigation.DoesNotExist, ValueError):
            raise ResourceDoesNotExist
        kwargs["investigation"] = investigation
        self.check_object_permissions(request, investigation)
        if not _required_investigation_project_ids(investigation).issubset(
            _accessible_project_ids(self, request, organization)
        ):
            raise PermissionDenied("You do not have access to every project in this investigation.")
        return args, kwargs


class OrganizationInvestigationBlockBase(OrganizationInvestigationBase):
    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        investigation_id: str,
        block_id: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(
            request, organization_id_or_slug, investigation_id, *args, **kwargs
        )
        try:
            kwargs["block"] = InvestigationBlock.objects.select_related("investigation").get(
                id=block_id, investigation=kwargs["investigation"]
            )
        except (InvestigationBlock.DoesNotExist, ValueError):
            raise ResourceDoesNotExist
        return args, kwargs


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationBreachedMetricInvestigationStatusEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    permission_classes = (InvestigationPermission,)
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization) -> Response:
        _require_breached_metric_feature(request, organization)
        group_ids = _parse_group_ids(request.data.get("groupIds"))
        if group_ids is None:
            return Response(
                {"detail": "groupIds must contain between 1 and 100 issue IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sources = resolve_breached_metric_sources(
            organization=organization,
            group_ids=group_ids,
            accessible_project_ids=_accessible_project_ids(self, request, organization),
        )
        existing = {
            investigation.source_key: investigation
            for investigation in Investigation.objects.filter(
                organization=organization,
                source_type="breached_metric",
                source_key__in=[source.source_key for source in sources.values()],
                status=InvestigationStatus.ACTIVE,
            ).order_by("source_key", "source_revision")
        }
        can_create = request.user.is_authenticated and not request.user.is_sentry_app
        items: dict[str, dict[str, str]] = {}
        for group_id in group_ids:
            source = sources.get(group_id)
            if source is None:
                items[str(group_id)] = {"status": "unavailable"}
                continue
            investigation = existing.get(source.source_key)
            if investigation is not None:
                items[str(group_id)] = {
                    "status": "view",
                    "investigationId": str(investigation.id),
                    "openPeriodId": str(source.open_period.id),
                }
                continue
            if not can_create:
                items[str(group_id)] = {"status": "unavailable"}
                continue
            items[str(group_id)] = {
                "status": "investigate",
                "openPeriodId": str(source.open_period.id),
            }
        return Response({"items": items})


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationBreachedMetricInvestigationLaunchEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    permission_classes = (InvestigationPermission,)
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization) -> Response:
        user_id = _require_authenticated_user(request)
        _require_breached_metric_feature(request, organization)
        group_ids = _parse_group_ids([request.data.get("groupId")])
        open_period_ids = _parse_group_ids([request.data.get("openPeriodId")])
        if group_ids is None or open_period_ids is None:
            return Response(
                {"detail": "groupId and openPeriodId must be issue IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        group_id = group_ids[0]
        open_period_id = open_period_ids[0]
        accessible_project_ids = _accessible_project_ids(self, request, organization)
        source = resolve_breached_metric_sources(
            organization=organization,
            group_ids=[group_id],
            accessible_project_ids=accessible_project_ids,
        ).get(group_id)
        if source is None or source.open_period.id != open_period_id:
            raise ResourceDoesNotExist

        created = False
        database = router.db_for_write(Investigation)
        try:
            with transaction.atomic(using=database):
                investigation = (
                    Investigation.objects.select_for_update()
                    .filter(
                        organization=organization,
                        source_type="breached_metric",
                        source_key=source.source_key,
                        status=InvestigationStatus.ACTIVE,
                    )
                    .first()
                )
                if investigation is None:
                    investigation = create_template_investigation(
                        organization=organization,
                        user_id=user_id,
                        template_key="breached_metric",
                        template_version=1,
                        source_ref={
                            "groupId": str(group_id),
                            "openPeriodId": str(open_period_id),
                        },
                        supplied_parameters={},
                        accessible_project_ids=accessible_project_ids,
                    )
                    created = True
                    schedule_eligible_auto_run_blocks(
                        investigation_id=investigation.id,
                        user_id=user_id,
                    )
        except IntegrityError:
            investigation = Investigation.objects.get(
                organization=organization,
                source_type="breached_metric",
                source_key=source.source_key,
                status=InvestigationStatus.ACTIVE,
            )
            created = False
        if created:
            investigation.refresh_from_db()
        return Response(
            _serialize_investigation(
                investigation,
                request,
                organization,
                detailed=True,
                accessible_project_ids=accessible_project_ids,
            ),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    permission_classes = (InvestigationPermission,)
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, organization: Organization) -> Response:
        if not _feature_enabled(request, organization):
            raise ResourceDoesNotExist
        requested_status = request.GET.get("status", InvestigationStatus.ACTIVE)
        if requested_status not in InvestigationStatus.values:
            return Response(
                {"detail": "Must be active or archived."}, status=status.HTTP_400_BAD_REQUEST
            )
        favorite = InvestigationFavoriteUser.objects.filter(
            investigation_id=OuterRef("id"), user_id=_user_id(request)
        )
        newer_lineage_revision = Investigation.objects.filter(
            organization_id=OuterRef("organization_id"),
            source_type=OuterRef("source_type"),
            source_key=OuterRef("source_key"),
            status=requested_status,
            source_revision__gt=OuterRef("source_revision"),
        )
        investigations = (
            Investigation.objects.filter(organization=organization, status=requested_status)
            .filter(Q(source_type=InvestigationSourceType.MANUAL) | ~Exists(newer_lineage_revision))
            .select_related("permissions")
            .prefetch_related("permissions__teams_with_edit_access")
            .annotate(
                active_block_count=Count(
                    "blocks", filter=Q(blocks__deleted_at__isnull=True), distinct=True
                ),
                is_favorited=Exists(favorite),
            )
        )
        query = request.GET.get("query")
        if query:
            investigations = investigations.filter(title__icontains=query)
        return self.paginate(
            request=request,
            queryset=investigations,
            paginator_cls=DateTimePaginator,
            order_by="-date_updated",
            on_results=lambda values: [
                _serialize_investigation(
                    value,
                    request,
                    organization,
                    detailed=False,
                )
                for value in values
            ],
        )

    def post(self, request: Request, organization: Organization) -> Response:
        _require_authenticated_user(request)
        if not _feature_enabled(request, organization):
            raise ResourceDoesNotExist
        serializer = InvestigationCreateValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        values = serializer.validated_data
        accessible_project_ids = _accessible_project_ids(self, request, organization)
        try:
            if "template_key" in values:
                investigation = create_template_investigation(
                    organization=organization,
                    user_id=_user_id(request),
                    template_key=values["template_key"],
                    template_version=values["template_version"],
                    source_ref=values["source_ref"],
                    supplied_parameters=values.get("parameters", {}),
                    accessible_project_ids=accessible_project_ids,
                    title=values.get("title"),
                )
            else:
                project_ids = values.get("project_ids", [])
                if not set(project_ids).issubset(accessible_project_ids):
                    return Response(
                        {"detail": "One or more projects are inaccessible."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                investigation = create_manual_investigation(
                    organization=organization,
                    user_id=_user_id(request),
                    title=values["title"],
                    project_ids=project_ids,
                    filters=values.get("filters", {}),
                )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(
            _serialize_investigation(
                investigation,
                request,
                organization,
                detailed=True,
                accessible_project_ids=accessible_project_ids,
            ),
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlocksEndpoint(OrganizationInvestigationBase):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        user_id = _require_authenticated_user(request)
        serializer = BlockCreateValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        values = dict(serializer.validated_data)
        investigation_version = values.pop("investigation_version")
        values["prompt"] = values.pop("generation_prompt", "")
        try:
            block = create_block(
                investigation=investigation,
                expected_investigation_version=investigation_version,
                user_id=user_id,
                values=values,
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(
            _serialize_block(
                block,
                request,
                _accessible_project_ids(self, request, organization),
            ),
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlockDetailsEndpoint(OrganizationInvestigationBlockBase):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE, "DELETE": ApiPublishStatus.PRIVATE}

    def put(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
    ) -> Response:
        user_id = _require_authenticated_user(request)
        if block.deleted_at is not None:
            raise ResourceDoesNotExist
        serializer = BlockUpdateValidator(data=request.data, context={"block": block})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        values = dict(serializer.validated_data)
        expected_investigation_version = values.pop("investigation_version")
        expected_block_version = values.pop("version")
        if "generation_prompt" in values:
            values["prompt"] = values.pop("generation_prompt")
        try:
            updated = update_block(
                block=block,
                expected_investigation_version=expected_investigation_version,
                expected_block_version=expected_block_version,
                user_id=user_id,
                values=values,
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(
            _serialize_block(
                updated,
                request,
                _accessible_project_ids(self, request, organization),
            )
        )

    def delete(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
    ) -> Response:
        _require_authenticated_user(request)
        if block.deleted_at is not None:
            raise ResourceDoesNotExist
        serializer = BlockDeleteValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            delete_block(
                block=block,
                expected_investigation_version=serializer.validated_data["investigation_version"],
                expected_block_version=serializer.validated_data["version"],
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlockOrderEndpoint(OrganizationInvestigationBase):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        _require_authenticated_user(request)
        serializer = BlockOrderValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            updated = reorder_blocks(
                investigation=investigation,
                expected_version=serializer.validated_data["investigation_version"],
                block_ids=serializer.validated_data["block_ids"],
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(
            _serialize_investigation(
                updated,
                request,
                organization,
                detailed=True,
                accessible_project_ids=_accessible_project_ids(self, request, organization),
            )
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationParametersEndpoint(OrganizationInvestigationBase):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        _require_authenticated_user(request)
        serializer = ParameterValuesValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            updated = update_parameter_values(
                investigation=investigation,
                expected_version=serializer.validated_data["investigation_version"],
                values=serializer.validated_data["values"],
                accessible_project_ids=_accessible_project_ids(self, request, organization),
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(
            _serialize_investigation(
                updated,
                request,
                organization,
                detailed=True,
                accessible_project_ids=_accessible_project_ids(self, request, organization),
            )
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationPermissionsEndpoint(OrganizationInvestigationBase):
    manager_or_creator_only = True
    prefetch_permission_teams = True
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "PUT": ApiPublishStatus.PRIVATE}

    def get(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        return Response(
            _serialize_permissions(
                investigation,
                user_id=_user_id(request),
                can_edit=_can_edit(request, organization, investigation),
                can_manage=_can_manage(request, organization, investigation),
            )
        )

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        _require_authenticated_user(request)
        serializer = PermissionsUpdateValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        team_ids = serializer.validated_data["team_ids"]
        if set(team_ids) != set(
            Team.objects.filter(organization=organization, id__in=team_ids).values_list(
                "id", flat=True
            )
        ):
            return Response(
                {"detail": "Teams must belong to the organization."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            update_permissions(
                investigation=investigation,
                expected_version=serializer.validated_data["investigation_version"],
                editable_by_everyone=serializer.validated_data["is_editable_by_everyone"],
                team_ids=team_ids,
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(
            _serialize_permissions(
                investigation,
                user_id=_user_id(request),
                can_edit=_can_edit(request, organization, investigation),
                can_manage=_can_manage(request, organization, investigation),
            )
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationDetailsEndpoint(OrganizationInvestigationBase):
    prefetch_permission_teams = True
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def get(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        return Response(
            _serialize_investigation(
                investigation,
                request,
                organization,
                detailed=True,
                accessible_project_ids=_accessible_project_ids(self, request, organization),
            )
        )

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        serializer = InvestigationUpdateValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        values = dict(serializer.validated_data)
        expected_version = values.pop("investigation_version")
        project_ids = values.pop("project_ids", None)
        if project_ids is not None and not set(project_ids).issubset(
            _accessible_project_ids(self, request, organization)
        ):
            return Response(
                {"detail": "One or more projects are inaccessible."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if "status" in values and values["status"] != investigation.status:
            _require_manager_or_creator(request, organization, investigation)
        if investigation.status == InvestigationStatus.ARCHIVED and values != {
            "status": InvestigationStatus.ACTIVE
        }:
            return Response(
                {"detail": "Archived investigations are read-only."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            updated = update_investigation(
                investigation=investigation,
                expected_version=expected_version,
                fields=values,
                project_ids=project_ids,
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(
            _serialize_investigation(
                updated,
                request,
                organization,
                detailed=True,
                accessible_project_ids=_accessible_project_ids(self, request, organization),
            )
        )

    def delete(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        _require_manager_or_creator(request, organization, investigation)
        serializer = InvestigationDeleteValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            archive_investigation(
                investigation=investigation,
                expected_version=serializer.validated_data["investigation_version"],
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationFavoriteEndpoint(OrganizationInvestigationBase):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}
    requires_investigation_edit_access = False

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        user_id = _require_authenticated_user(request)
        serializer = FavoriteUpdateValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        if serializer.validated_data["should_favorite"]:
            InvestigationFavoriteUser.objects.get_or_create(
                investigation=investigation, user_id=user_id
            )
        else:
            InvestigationFavoriteUser.objects.filter(
                investigation=investigation, user_id=user_id
            ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlockExecuteEndpoint(OrganizationInvestigationBlockBase):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
    ) -> Response:
        user_id = _require_authenticated_user(request)
        if not _query_execution_enabled(request, organization):
            raise ResourceDoesNotExist
        serializer = BlockExecutionStartValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        accessible_project_ids = _accessible_project_ids(self, request, organization)
        selected_project_ids = set(
            investigation.projects.order_by("id").values_list("id", flat=True)
        )
        if selected_project_ids:
            if not selected_project_ids.issubset(accessible_project_ids):
                return Response(
                    {"detail": "One or more investigation projects are inaccessible."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            project_ids = sorted(selected_project_ids)
        elif block.kind == InvestigationBlockKind.QUERY:
            project_ids = sorted(accessible_project_ids)
        else:
            project_ids = []
        # Constructing the client performs the normal Seer entitlement check before
        # we create durable state that could never be dispatched.
        client = SeerAgentClient(organization, request.user)
        try:
            execution, created = create_block_execution(
                block=block,
                expected_investigation_version=serializer.validated_data["investigation_version"],
                expected_block_version=serializer.validated_data["version"],
                user_id=user_id,
                project_ids=project_ids,
                accessible_project_ids=accessible_project_ids,
                request_id=serializer.validated_data.get("request_id"),
            )
        except Exception as execution_error:
            response = _service_error(execution_error)
            if response is not None:
                return response
            raise

        if created:
            metric_namespace = (
                "investigations.query_execution"
                if block.kind == InvestigationBlockKind.QUERY
                else "investigations.text_execution"
            )
            try:
                start_execution_run(execution, organization, request.user, client=client)
                metrics.incr(
                    f"{metric_namespace}.started",
                    tags={"executor": execution.executor},
                )
            except Exception:
                mark_block_execution_dispatch_failed(execution)
                metrics.incr(f"{metric_namespace}.dispatch_failed")
                raise

        execution = InvestigationBlockExecution.objects.get(id=execution.id)
        return Response(
            {"id": str(execution.id), "status": execution.status},
            status=status.HTTP_202_ACCEPTED,
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlockExecutionEndpoint(OrganizationInvestigationBlockBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PATCH": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def _execution(
        self, block: InvestigationBlock, execution_id: str
    ) -> InvestigationBlockExecution:
        try:
            return InvestigationBlockExecution.objects.select_related("seer_run").get(
                id=execution_id, block=block
            )
        except (InvestigationBlockExecution.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

    def get(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
        execution_id: str,
    ) -> Response:
        if not _query_execution_enabled(request, organization):
            raise ResourceDoesNotExist
        execution = self._execution(block, execution_id)
        pending = None
        partial_markdown = None
        if execution.seer_run and execution.seer_run.seer_run_state_id:
            state = SeerAgentClient(organization, request.user).get_run(
                execution.seer_run.seer_run_state_id
            )
            synchronize_execution(execution, state)
            execution.refresh_from_db()
            pending = state.pending_user_input.dict() if state.pending_user_input else None
            if block.kind == InvestigationBlockKind.TEXT:
                partial_markdown = next(
                    (
                        block.message.content
                        for block in reversed(state.blocks)
                        if block.message.role == "assistant" and block.message.content
                    ),
                    None,
                )
        return Response(
            {
                "id": str(execution.id),
                "status": execution.status,
                "blocks": execution.transcript,
                "transcriptTruncated": execution.transcript_truncated,
                "pendingUserInput": pending,
                "partialMarkdown": partial_markdown,
                "error": execution.error,
            }
        )

    def patch(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
        execution_id: str,
    ) -> Response:
        if not _query_execution_enabled(request, organization):
            raise ResourceDoesNotExist
        execution = self._execution(block, execution_id)
        if not execution.seer_run or not execution.seer_run.seer_run_state_id:
            return Response({"detail": "The run has not started."}, status=409)
        input_id = request.data.get("inputId")
        if not input_id or "responseData" not in request.data:
            return Response({"detail": "inputId and responseData are required."}, status=400)
        response = make_agent_update_request(
            AgentUpdateRequest(
                run_id=execution.seer_run.seer_run_state_id,
                organization_id=organization.id,
                payload={
                    "type": "user_input_response",
                    "input_id": input_id,
                    "response_data": request.data["responseData"],
                },
            )
        )
        if response.status >= 400:
            return Response({"detail": "Unable to resume the run."}, status=502)
        InvestigationBlockExecution.objects.filter(id=execution.id).update(
            status=InvestigationBlockExecutionStatus.RUNNING
        )
        return Response(status=202)

    def delete(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
        execution_id: str,
    ) -> Response:
        if not _query_execution_enabled(request, organization):
            raise ResourceDoesNotExist
        execution = self._execution(block, execution_id)
        if not execution.seer_run or not execution.seer_run.seer_run_state_id:
            return Response(status=204)
        InvestigationBlockExecution.objects.filter(id=execution.id).update(
            status=InvestigationBlockExecutionStatus.STOPPING
        )
        interrupt_run(organization, execution.seer_run.seer_run_state_id)
        InvestigationBlockExecution.objects.filter(id=execution.id).update(
            status=InvestigationBlockExecutionStatus.CANCELLED,
            completed_at=timezone.now(),
        )
        return Response(status=202)


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationTitleGenerationEndpoint(OrganizationInvestigationBase):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
    ) -> Response:
        if not _query_execution_enabled(request, organization):
            raise ResourceDoesNotExist
        preview = None
        if investigation.title_seer_run and investigation.title_seer_run.seer_run_state_id:
            state = SeerAgentClient(organization, request.user).get_run(
                investigation.title_seer_run.seer_run_state_id
            )
            synchronize_title(investigation, state)
            investigation.refresh_from_db()
            preview = next(
                (
                    block.message.content
                    for block in reversed(state.blocks)
                    if block.message.role == "assistant" and block.message.content
                ),
                None,
            )
        return Response({"status": investigation.title_generation_status, "preview": preview})


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationDuplicateEndpoint(OrganizationInvestigationBase):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        user_id = _require_authenticated_user(request)
        duplicate = duplicate_investigation(investigation=investigation, user_id=user_id)
        return Response(
            _serialize_investigation(
                duplicate,
                request,
                organization,
                detailed=True,
                accessible_project_ids=_accessible_project_ids(self, request, organization),
            ),
            status=status.HTTP_201_CREATED,
        )
