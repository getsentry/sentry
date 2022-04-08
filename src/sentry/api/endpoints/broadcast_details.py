import logging

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import AdminBroadcastSerializer, BroadcastSerializer, serialize
from sentry.api.validators import AdminBroadcastValidator, BroadcastValidator
from sentry.models import Broadcast, BroadcastSeen

logger = logging.getLogger("sentry")


from rest_framework.request import Request
from rest_framework.response import Response


class BroadcastDetailsEndpoint(Endpoint):
    permission_classes = (IsAuthenticated,)

    def _get_broadcast(self, request: Request, broadcast_id):
        if request.access.has_permission("broadcasts.admin"):
            queryset = Broadcast.objects.all()
        else:
            queryset = Broadcast.objects.filter(
                Q(date_expires__isnull=True) | Q(date_expires__gt=timezone.now()), is_active=True
            )
        try:
            return queryset.get(id=int(broadcast_id))
        except (Broadcast.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

    def _get_validator(self, request: Request):
        if request.access.has_permission("broadcasts.admin"):
            return AdminBroadcastValidator
        return BroadcastValidator

    def _get_serializer(self, request: Request):
        if request.access.has_permission("broadcasts.admin"):
            return AdminBroadcastSerializer
        return BroadcastSerializer

    def _serialize_response(self, request: Request, broadcast):
        serializer_cls = self._get_serializer(request)
        return self.respond(serialize(broadcast, request.user, serializer=serializer_cls()))

    def get(self, request: Request, broadcast_id) -> Response:
        broadcast = self._get_broadcast(request, broadcast_id)
        return self._serialize_response(request, broadcast)

    def put(self, request: Request, broadcast_id) -> Response:
        broadcast = self._get_broadcast(request, broadcast_id)
        validator = self._get_validator(request)(data=request.data, partial=True)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data

        update_kwargs = {}
        if result.get("title"):
            update_kwargs["title"] = result["title"]
        if result.get("message"):
            update_kwargs["message"] = result["message"]
        if result.get("link"):
            update_kwargs["link"] = result["link"]
        if result.get("isActive") is not None:
            update_kwargs["is_active"] = result["isActive"]
        if result.get("dateExpires", -1) != -1:
            update_kwargs["date_expires"] = result["dateExpires"]
        if result.get("cta"):
            update_kwargs["cta"] = result["cta"]
        if update_kwargs:
            with transaction.atomic():
                broadcast.update(**update_kwargs)
                logger.info(
                    "broadcasts.update",
                    extra={
                        "ip_address": request.META["REMOTE_ADDR"],
                        "user_id": request.user.id,
                        "broadcast_id": broadcast.id,
                        "data": update_kwargs,
                    },
                )

        if result.get("hasSeen"):
            try:
                with transaction.atomic():
                    BroadcastSeen.objects.create(broadcast=broadcast, user=request.user)
            except IntegrityError:
                pass

        return self._serialize_response(request, broadcast)
