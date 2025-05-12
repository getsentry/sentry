from __future__ import annotations

import logging
from functools import reduce
from operator import or_

from django.db import IntegrityError, router, transaction
from django.db.models import Q
from django.utils import timezone

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import AdminBroadcastSerializer, BroadcastSerializer, serialize
from sentry.api.validators import AdminBroadcastValidator, BroadcastValidator
from sentry.db.models.query import in_icontains
from sentry.models.broadcast import Broadcast, BroadcastSeen
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.search.utils import tokenize_query
from sentry.users.models.user import User

logger = logging.getLogger("sentry")


from rest_framework.request import Request
from rest_framework.response import Response


@control_silo_endpoint
class BroadcastIndexEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.UNOWNED
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationPermission,)

    def _get_serializer(self, request: Request):
        if request.access.has_permission("broadcasts.admin"):
            return AdminBroadcastSerializer
        return BroadcastSerializer

    def _serialize_objects(self, items, request):
        serializer_cls = self._get_serializer(request)
        return serialize(items, request.user, serializer=serializer_cls())

    def _secondary_filtering(self, request: Request, organization_slug, queryset):
        # used in the SAAS product
        return list(queryset)

    def convert_args(self, request: Request, *args, **kwargs):
        organization_id_or_slug: int | str | None = None
        if args and args[0] is not None:
            organization_id_or_slug = args[0]
            # Required so it behaves like the original convert_args, where organization_id_or_slug was another parameter
            # TODO: Remove this once we remove the old `organization_slug` parameter from getsentry
            args = args[1:]
        else:
            organization_id_or_slug = kwargs.pop("organization_id_or_slug", None) or kwargs.pop(
                "organization_slug", None
            )
        if organization_id_or_slug:
            args, kwargs = super().convert_args(request, organization_id_or_slug)

        return (args, kwargs)

    def get(
        self, request: Request, organization: RpcOrganization | None = None, **kwargs
    ) -> Response:
        if request.GET.get("show") == "all" and request.access.has_permission("broadcasts.admin"):
            # superusers can slice and dice
            queryset = Broadcast.objects.all().order_by("-date_added")
        else:
            # only allow active broadcasts if they're not a superuser
            queryset = Broadcast.objects.filter(
                Q(date_expires__isnull=True) | Q(date_expires__gt=timezone.now()), is_active=True
            ).order_by("-date_added")

        query = request.GET.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "query":
                    value_str = " ".join(value)
                    queryset = queryset.filter(
                        Q(title__icontains=value_str)
                        | Q(message__icontains=value_str)
                        | Q(link__icontains=value_str)
                    )
                elif key == "id":
                    queryset = queryset.filter(id__in=value)
                elif key == "link":
                    queryset = queryset.filter(in_icontains("link", value))
                elif key == "status":
                    filters = []
                    for v in value:
                        v = v.lower()
                        if v == "active":
                            filters.append(
                                Q(date_expires__isnull=True, is_active=True)
                                | Q(date_expires__gt=timezone.now(), is_active=True)
                            )
                        elif v == "inactive":
                            filters.append(Q(date_expires__lt=timezone.now()) | Q(is_active=False))
                        else:
                            queryset = queryset.none()
                    if filters:
                        queryset = queryset.filter(reduce(or_, filters))
                else:
                    queryset = queryset.none()

        if organization:
            data = self._secondary_filtering(request, organization, queryset)
            return self.respond(self._serialize_objects(data, request))

        sort_by = request.GET.get("sortBy")
        if sort_by == "expires":
            order_by = "-date_expires"
            paginator_cls = DateTimePaginator
        else:
            order_by = "-date_added"
            paginator_cls = DateTimePaginator

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            on_results=lambda x: self._serialize_objects(x, request),
            paginator_cls=paginator_cls,
        )

    def put(self, request: Request):
        validator = BroadcastValidator(data=request.data, partial=True)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data

        queryset = Broadcast.objects.filter(is_active=True)

        ids = request.GET.getlist("id")
        if ids:
            queryset = queryset.filter(id__in=ids)

        if result.get("hasSeen"):
            if not request.user.is_authenticated:
                return self.respond(status=401)

            if ids:
                unseen_queryset = queryset
            else:
                unseen_queryset = queryset.exclude(
                    id__in=queryset.filter(broadcastseen__user_id=request.user.id).values("id")
                )

            for broadcast in unseen_queryset:
                try:
                    with transaction.atomic(using=router.db_for_write(BroadcastSeen)):
                        BroadcastSeen.objects.create(broadcast=broadcast, user_id=request.user.id)
                except IntegrityError:
                    pass

        return self.respond(result)

    def post(self, request: Request) -> Response:
        if not request.access.has_permission("broadcasts.admin"):
            return self.respond(status=401)

        validator = AdminBroadcastValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data

        with transaction.atomic(using=router.db_for_write(Broadcast)):
            broadcast = Broadcast.objects.create(
                title=result["title"],
                message=result["message"],
                link=result["link"],
                is_active=result.get("isActive") or False,
                date_expires=result.get("dateExpires"),
                media_url=result.get("mediaUrl"),
                category=result.get("category"),
                created_by_id=User.objects.get(id=request.user.id),
            )
            logger.info(
                "broadcasts.create",
                extra={
                    "ip_address": request.META["REMOTE_ADDR"],
                    "user_id": request.user.id,
                    "broadcast_id": broadcast.id,
                },
            )

        if result.get("hasSeen"):
            try:
                with transaction.atomic(using=router.db_for_write(BroadcastSeen)):
                    BroadcastSeen.objects.create(broadcast=broadcast, user_id=request.user.id)
            except IntegrityError:
                pass

        return self.respond(self._serialize_objects(broadcast, request))
