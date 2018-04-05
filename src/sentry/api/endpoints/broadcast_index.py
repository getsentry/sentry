from __future__ import absolute_import

import logging
import six

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from operator import or_
from rest_framework.permissions import IsAuthenticated

from sentry.api.base import Endpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize, AdminBroadcastSerializer, BroadcastSerializer
from sentry.api.validators import AdminBroadcastValidator, BroadcastValidator
from sentry.auth.superuser import is_active_superuser
from sentry.db.models.query import in_icontains
from sentry.models import Broadcast, BroadcastSeen
from sentry.search.utils import tokenize_query

logger = logging.getLogger('sentry')


class BroadcastIndexEndpoint(Endpoint):
    permission_classes = (IsAuthenticated, )

    def _serialize_objects(self, items, request):
        if is_active_superuser(request):
            serializer_cls = AdminBroadcastSerializer
        else:
            serializer_cls = BroadcastSerializer

        return serialize(items, request.user, serializer=serializer_cls())

    def get(self, request):
        if request.GET.get('show') == 'all' and is_active_superuser(
                request) and request.access.has_permission('broadcasts.admin'):
            # superusers can slice and dice
            queryset = Broadcast.objects.all()
        else:
            # only allow active broadcasts if they're not a superuser
            queryset = Broadcast.objects.filter(
                Q(date_expires__isnull=True) | Q(date_expires__gt=timezone.now()),
                is_active=True,
            ).order_by('-date_added')

        query = request.GET.get('query')
        if query:
            tokens = tokenize_query(query)
            for key, value in six.iteritems(tokens):
                if key == 'query':
                    value = ' '.join(value)
                    queryset = queryset.filter(
                        Q(title__icontains=value) | Q(
                            message__icontains=value) | Q(link__icontains=value)
                    )
                elif key == 'id':
                    queryset = queryset.filter(id__in=value)
                elif key == 'link':
                    queryset = queryset.filter(in_icontains('link', value))
                elif key == 'status':
                    filters = []
                    for v in value:
                        v = v.lower()
                        if v == 'active':
                            filters.append(
                                Q(date_expires__isnull=True, is_active=True) | Q(
                                    date_expires__gt=timezone.now(), is_active=True)
                            )
                        elif v == 'inactive':
                            filters.append(
                                Q(date_expires__lt=timezone.now()) | Q(is_active=False)
                            )
                        else:
                            queryset = queryset.none()
                    if filters:
                        queryset = queryset.filter(reduce(or_, filters))
                else:
                    queryset = queryset.none()

        sort_by = request.GET.get('sortBy')
        if sort_by == 'expires':
            order_by = '-date_expires'
            paginator_cls = DateTimePaginator
        else:
            order_by = '-date_added'
            paginator_cls = DateTimePaginator

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            on_results=lambda x: self._serialize_objects(x, request),
            paginator_cls=paginator_cls,
        )

    def put(self, request):
        validator = BroadcastValidator(data=request.DATA, partial=True)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.object

        queryset = Broadcast.objects.filter(
            is_active=True,
        )

        ids = request.GET.getlist('id')
        if ids:
            queryset = queryset.filter(
                id__in=ids,
            )

        if result.get('hasSeen'):
            if not request.user.is_authenticated():
                return self.respond(status=401)

            if ids:
                unseen_queryset = queryset
            else:
                unseen_queryset = queryset.exclude(
                    id__in=queryset.filter(
                        broadcastseen__user=request.user,
                    ).values('id')
                )

            for broadcast in unseen_queryset:
                try:
                    with transaction.atomic():
                        BroadcastSeen.objects.create(
                            broadcast=broadcast,
                            user=request.user,
                        )
                except IntegrityError:
                    pass

        return self.respond(result)

    def post(self, request):
        if not (is_active_superuser(request) and request.access.has_permission('broadcasts.admin')):
            return self.respond(status=401)

        validator = AdminBroadcastValidator(data=request.DATA)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.object

        with transaction.atomic():
            broadcast = Broadcast.objects.create(
                title=result['title'],
                message=result['message'],
                link=result['link'],
                is_active=result.get('isActive') or False,
                date_expires=result.get('expiresAt'),
            )
            logger.info('broadcasts.create', extra={
                'ip_address': request.META['REMOTE_ADDR'],
                'user_id': request.user.id,
                'broadcast_id': broadcast.id,
            })

        if result.get('hasSeen'):
            try:
                with transaction.atomic():
                    BroadcastSeen.objects.create(
                        broadcast=broadcast,
                        user=request.user,
                    )
            except IntegrityError:
                pass

        return self.respond(self._serialize_objects(broadcast, request))
