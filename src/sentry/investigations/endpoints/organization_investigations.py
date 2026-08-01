from __future__ import annotations

from typing import Any

from django.db.models import Count, Exists, OuterRef, Q, QuerySet
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
from sentry.investigations.models import (
    Investigation,
    InvestigationCell,
    InvestigationCellComment,
    InvestigationFavoriteUser,
    InvestigationReaction,
    InvestigationStatus,
)
from sentry.investigations.permissions import (
    InvestigationPermission,
    is_organization_manager,
)
from sentry.investigations.serializers import (
    CellCreateSerializer,
    CellDeleteSerializer,
    CellOrderSerializer,
    CellUpdateSerializer,
    CommentSerializer,
    FavoriteUpdateSerializer,
    InvestigationCreateSerializer,
    InvestigationDeleteSerializer,
    InvestigationUpdateSerializer,
    ParameterValuesSerializer,
    PermissionsUpdateSerializer,
    comments_with_serialization_data,
    serialize_cell,
    serialize_comment,
    serialize_investigation_detail,
    serialize_investigation_list,
    serialize_permissions,
)
from sentry.investigations.services import (
    InvestigationConflictError,
    InvestigationSourceNotFound,
    InvestigationValidationError,
    archive_investigation,
    create_cell,
    create_comment,
    create_manual_investigation,
    create_template_investigation,
    delete_cell,
    delete_comment,
    duplicate_investigation,
    reorder_cells,
    set_cell_reaction,
    set_comment_reaction,
    update_cell,
    update_comment,
    update_investigation,
    update_parameter_values,
    update_permissions,
    validate_mentions,
)
from sentry.models.organization import Organization
from sentry.models.team import Team

FEATURE = "organizations:investigations"


def _feature_enabled(request: Request, organization: Organization) -> bool:
    return features.has(FEATURE, organization, actor=request.user)


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


class OrganizationInvestigationBase(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    permission_classes = (InvestigationPermission,)

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        investigation_uuid: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)
        organization = kwargs["organization"]
        if not _feature_enabled(request, organization):
            raise ResourceDoesNotExist
        try:
            investigation = Investigation.objects.select_related("organization").get(
                uuid=investigation_uuid, organization=organization
            )
        except (Investigation.DoesNotExist, ValueError):
            raise ResourceDoesNotExist
        kwargs["investigation"] = investigation
        self.check_object_permissions(request, investigation)
        return args, kwargs


class OrganizationInvestigationCellBase(OrganizationInvestigationBase):
    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        investigation_uuid: str,
        cell_uuid: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(
            request, organization_id_or_slug, investigation_uuid, *args, **kwargs
        )
        try:
            kwargs["cell"] = InvestigationCell.objects.select_related("investigation").get(
                uuid=cell_uuid, investigation=kwargs["investigation"]
            )
        except (InvestigationCell.DoesNotExist, ValueError):
            raise ResourceDoesNotExist
        return args, kwargs


class OrganizationInvestigationCommentBase(OrganizationInvestigationBase):
    collaboration_endpoint = True

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        investigation_uuid: str,
        comment_uuid: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(
            request, organization_id_or_slug, investigation_uuid, *args, **kwargs
        )
        try:
            kwargs["comment"] = InvestigationCellComment.objects.select_related(
                "cell__investigation"
            ).get(uuid=comment_uuid, cell__investigation=kwargs["investigation"])
        except (InvestigationCellComment.DoesNotExist, ValueError):
            raise ResourceDoesNotExist
        return args, kwargs


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
                {"status": "Must be active or archived."}, status=status.HTTP_400_BAD_REQUEST
            )
        favorite = InvestigationFavoriteUser.objects.filter(
            investigation_id=OuterRef("id"), user_id=_user_id(request)
        )
        investigations = (
            Investigation.objects.filter(organization=organization, status=requested_status)
            .select_related("permissions")
            .prefetch_related("permissions__teams_with_edit_access")
            .annotate(
                active_cell_count=Count(
                    "cells", filter=Q(cells__deleted_at__isnull=True), distinct=True
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
                serialize_investigation_list(
                    value,
                    user_id=_user_id(request),
                    can_edit=_can_edit(request, organization, value),
                    can_manage=_can_manage(request, organization, value),
                )
                for value in values
            ],
        )

    def post(self, request: Request, organization: Organization) -> Response:
        _require_authenticated_user(request)
        if not _feature_enabled(request, organization):
            raise ResourceDoesNotExist
        serializer = InvestigationCreateSerializer(data=request.data)
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
                        {"projectIds": "One or more projects are inaccessible."},
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
            serialize_investigation_detail(
                investigation,
                user_id=_user_id(request),
                accessible_project_ids=accessible_project_ids,
                can_edit=_can_edit(request, organization, investigation),
                can_manage=_can_manage(request, organization, investigation),
            ),
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationDetailsEndpoint(OrganizationInvestigationBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def get(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        return Response(
            serialize_investigation_detail(
                investigation,
                user_id=_user_id(request),
                accessible_project_ids=_accessible_project_ids(self, request, organization),
                can_edit=_can_edit(request, organization, investigation),
                can_manage=_can_manage(request, organization, investigation),
            )
        )

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        serializer = InvestigationUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        values = dict(serializer.validated_data)
        expected_version = values.pop("investigation_version")
        project_ids = values.pop("project_ids", None)
        if project_ids is not None and not set(project_ids).issubset(
            _accessible_project_ids(self, request, organization)
        ):
            return Response(
                {"projectIds": "One or more projects are inaccessible."},
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
            serialize_investigation_detail(
                updated,
                user_id=_user_id(request),
                accessible_project_ids=_accessible_project_ids(self, request, organization),
                can_edit=_can_edit(request, organization, updated),
                can_manage=_can_manage(request, organization, updated),
            )
        )

    def delete(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        _require_manager_or_creator(request, organization, investigation)
        serializer = InvestigationDeleteSerializer(data=request.data)
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

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        user_id = _require_authenticated_user(request)
        serializer = FavoriteUpdateSerializer(data=request.data)
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
class OrganizationInvestigationDuplicateEndpoint(OrganizationInvestigationBase):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        user_id = _require_authenticated_user(request)
        duplicate = duplicate_investigation(investigation=investigation, user_id=user_id)
        return Response(
            serialize_investigation_detail(
                duplicate,
                user_id=user_id,
                accessible_project_ids=_accessible_project_ids(self, request, organization),
                can_edit=True,
                can_manage=True,
            ),
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationCellsEndpoint(OrganizationInvestigationBase):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        serializer = CellCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        values = dict(serializer.validated_data)
        investigation_version = values.pop("investigation_version")
        values["prompt"] = values.pop("generation_prompt", "")
        try:
            cell = create_cell(
                investigation=investigation,
                expected_investigation_version=investigation_version,
                user_id=_user_id(request),
                values=values,
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(
            serialize_cell(
                cell,
                user_id=_user_id(request),
                accessible_project_ids=_accessible_project_ids(self, request, organization),
            ),
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationCellDetailsEndpoint(OrganizationInvestigationCellBase):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE, "DELETE": ApiPublishStatus.PRIVATE}

    def put(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        cell: InvestigationCell,
    ) -> Response:
        if cell.deleted_at is not None:
            raise ResourceDoesNotExist
        serializer = CellUpdateSerializer(data=request.data, context={"cell": cell})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        values = dict(serializer.validated_data)
        expected_investigation_version = values.pop("investigation_version")
        expected_cell_version = values.pop("version")
        if "generation_prompt" in values:
            values["prompt"] = values.pop("generation_prompt")
        try:
            updated = update_cell(
                cell=cell,
                expected_investigation_version=expected_investigation_version,
                expected_cell_version=expected_cell_version,
                user_id=_user_id(request),
                values=values,
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(
            serialize_cell(
                updated,
                user_id=_user_id(request),
                accessible_project_ids=_accessible_project_ids(self, request, organization),
            )
        )

    def delete(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        cell: InvestigationCell,
    ) -> Response:
        if cell.deleted_at is not None:
            raise ResourceDoesNotExist
        serializer = CellDeleteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            delete_cell(
                cell=cell,
                expected_investigation_version=serializer.validated_data["investigation_version"],
                expected_cell_version=serializer.validated_data["version"],
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationCellOrderEndpoint(OrganizationInvestigationBase):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        serializer = CellOrderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            updated = reorder_cells(
                investigation=investigation,
                expected_version=serializer.validated_data["investigation_version"],
                cell_uuids=[str(value) for value in serializer.validated_data["cell_ids"]],
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(
            serialize_investigation_detail(
                updated,
                user_id=_user_id(request),
                accessible_project_ids=_accessible_project_ids(self, request, organization),
                can_edit=_can_edit(request, organization, updated),
                can_manage=_can_manage(request, organization, updated),
            )
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationParametersEndpoint(OrganizationInvestigationBase):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        serializer = ParameterValuesSerializer(data=request.data)
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
            serialize_investigation_detail(
                updated,
                user_id=_user_id(request),
                accessible_project_ids=_accessible_project_ids(self, request, organization),
                can_edit=_can_edit(request, organization, updated),
                can_manage=_can_manage(request, organization, updated),
            )
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationPermissionsEndpoint(OrganizationInvestigationBase):
    manager_or_creator_only = True
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "PUT": ApiPublishStatus.PRIVATE}

    def get(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        permissions = investigation.permissions
        return Response(
            serialize_permissions(
                permissions,
                user_id=_user_id(request),
                can_edit=_can_edit(request, organization, investigation),
                can_manage=_can_manage(request, organization, investigation),
            )
        )

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        serializer = PermissionsUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        team_ids = serializer.validated_data["team_ids"]
        if set(team_ids) != set(
            Team.objects.filter(organization=organization, id__in=team_ids).values_list(
                "id", flat=True
            )
        ):
            return Response(
                {"teamIds": "Teams must belong to the organization."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            permissions = update_permissions(
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
            serialize_permissions(
                permissions,
                user_id=_user_id(request),
                can_edit=_can_edit(request, organization, investigation),
                can_manage=_can_manage(request, organization, investigation),
            )
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationCommentsEndpoint(OrganizationInvestigationCellBase):
    collaboration_endpoint = True
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}

    def get(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        cell: InvestigationCell,
    ) -> Response:
        comments: QuerySet[InvestigationCellComment] = comments_with_serialization_data(
            InvestigationCellComment.objects.filter(cell=cell)
        )
        return self.paginate(
            request=request,
            queryset=comments,
            paginator_cls=DateTimePaginator,
            order_by="date_added",
            on_results=lambda values: [
                serialize_comment(value, user_id=_user_id(request)) for value in values
            ],
        )

    def post(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        cell: InvestigationCell,
    ) -> Response:
        author_id = _require_authenticated_user(request)
        serializer = CommentSerializer(data=request.data, context={"organization": organization})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            user_ids, team_ids = validate_mentions(
                organization=organization,
                mentions=serializer.validated_data.get("mentions", []),
            )
            comment = create_comment(
                cell=cell,
                author_id=author_id,
                body=serializer.validated_data["body"],
                user_ids=user_ids,
                team_ids=team_ids,
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(
            serialize_comment(comment, user_id=_user_id(request)),
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationCommentDetailsEndpoint(OrganizationInvestigationCommentBase):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE, "DELETE": ApiPublishStatus.PRIVATE}

    def put(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        comment: InvestigationCellComment,
    ) -> Response:
        _require_authenticated_user(request)
        if comment.author_id != _user_id(request):
            raise PermissionDenied
        serializer = CommentSerializer(data=request.data, context={"organization": organization})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            user_ids, team_ids = validate_mentions(
                organization=organization,
                mentions=serializer.validated_data.get("mentions", []),
            )
            updated = update_comment(
                comment=comment,
                body=serializer.validated_data["body"],
                user_ids=user_ids,
                team_ids=team_ids,
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(serialize_comment(updated, user_id=_user_id(request)))

    def delete(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        comment: InvestigationCellComment,
    ) -> Response:
        _require_authenticated_user(request)
        if comment.author_id != _user_id(request) and not is_organization_manager(
            request, organization
        ):
            raise PermissionDenied
        try:
            delete_comment(comment)
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationCellReactionEndpoint(OrganizationInvestigationCellBase):
    collaboration_endpoint = True
    publish_status = {"PUT": ApiPublishStatus.PRIVATE, "DELETE": ApiPublishStatus.PRIVATE}

    def _set(
        self, request: Request, cell: InvestigationCell, reaction: str, *, enabled: bool
    ) -> Response:
        user_id = _require_authenticated_user(request)
        if reaction not in InvestigationReaction.values:
            return Response(
                {"reaction": "Unsupported reaction."}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            set_cell_reaction(cell=cell, user_id=user_id, reaction=reaction, enabled=enabled)
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(status=status.HTTP_204_NO_CONTENT)

    def put(
        self, request: Request, cell: InvestigationCell, reaction: str, **kwargs: Any
    ) -> Response:
        return self._set(request, cell, reaction, enabled=True)

    def delete(
        self, request: Request, cell: InvestigationCell, reaction: str, **kwargs: Any
    ) -> Response:
        return self._set(request, cell, reaction, enabled=False)


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationCommentReactionEndpoint(OrganizationInvestigationCommentBase):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE, "DELETE": ApiPublishStatus.PRIVATE}

    def _set(
        self,
        request: Request,
        comment: InvestigationCellComment,
        reaction: str,
        *,
        enabled: bool,
    ) -> Response:
        user_id = _require_authenticated_user(request)
        if reaction not in InvestigationReaction.values:
            return Response(
                {"reaction": "Unsupported reaction."}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            set_comment_reaction(
                comment=comment,
                user_id=user_id,
                reaction=reaction,
                enabled=enabled,
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise
        return Response(status=status.HTTP_204_NO_CONTENT)

    def put(
        self, request: Request, comment: InvestigationCellComment, reaction: str, **kwargs: Any
    ) -> Response:
        return self._set(request, comment, reaction, enabled=True)

    def delete(
        self, request: Request, comment: InvestigationCellComment, reaction: str, **kwargs: Any
    ) -> Response:
        return self._set(request, comment, reaction, enabled=False)
