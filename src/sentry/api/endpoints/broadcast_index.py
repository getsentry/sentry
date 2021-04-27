import logging
from functools import reduce
from operator import or_

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import AdminBroadcastSerializer, BroadcastSerializer, serialize
from sentry.api.validators import AdminBroadcastValidator, BroadcastValidator
from sentry.auth.superuser import is_active_superuser
from sentry.db.models.query import in_icontains
from sentry.models import Broadcast, BroadcastSeen
from sentry.search.utils import tokenize_query

logger = logging.getLogger("sentry")


class BroadcastIndexEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationPermission,)

    def _get_serializer(self, request):
        if is_active_superuser(request):
            return AdminBroadcastSerializer
        return BroadcastSerializer

    def _serialize_objects(self, items, request):
        serializer_cls = self._get_serializer(request)
        return serialize(items, request.user, serializer=serializer_cls())

    def _secondary_filtering(self, request, organization_slug, queryset):
        # used in the SASS product
        return list(queryset)

    def convert_args(self, request, organization_slug=None, *args, **kwargs):
        if organization_slug:
            args, kwargs = super().convert_args(request, organization_slug)

        return (args, kwargs)

    def get(self, request, organization=None):
        if (
            request.GET.get("show") == "all"
            and is_active_superuser(request)
            and request.access.has_permission("broadcasts.admin")
        ):
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
                    value = " ".join(value)
                    queryset = queryset.filter(
                        Q(title__icontains=value)
                        | Q(message__icontains=value)
                        | Q(link__icontains=value)
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

    def put(self, request):
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
                    id__in=queryset.filter(broadcastseen__user=request.user).values("id")
                )

            for broadcast in unseen_queryset:
                try:
                    with transaction.atomic():
                        BroadcastSeen.objects.create(broadcast=broadcast, user=request.user)
                except IntegrityError:
                    pass

        return self.respond(result)

    def post(self, request):
        if not (is_active_superuser(request) and request.access.has_permission("broadcasts.admin")):
            return self.respond(status=401)

        validator = AdminBroadcastValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data

        with transaction.atomic():
            broadcast = Broadcast.objects.create(
                title=result["title"],
                message=result["message"],
                link=result["link"],
                cta=result["cta"],
                is_active=result.get("isActive") or False,
                date_expires=result.get("dateExpires"),
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
                with transaction.atomic():
                    BroadcastSeen.objects.create(broadcast=broadcast, user=request.user)
            except IntegrityError:
                pass

        return self.respond(self._serialize_objects(broadcast, request))
