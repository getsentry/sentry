from __future__ import absolute_import

from django.db.models import Q

from sentry.api.base import Endpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import serialize
from sentry.models import User
from sentry.search.utils import tokenize_query


def in_iexact(column, values):
    from operator import or_

    query = '{}__iexact'.format(column)

    return reduce(or_, [Q(**{query: v}) for v in values])


class UserIndexEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        queryset = User.objects.distinct()

        query = request.GET.get('query')
        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.iteritems():
                if key == 'query':
                    value = ' '.join(value)
                    queryset = queryset.filter(
                        Q(name__icontains=value) |
                        Q(username__icontains=value) |
                        Q(email__icontains=value)
                    )
                elif key == 'name':
                    queryset = queryset.filter(
                        in_iexact('name', value)
                    )
                elif key == 'email':
                    queryset = queryset.filter(
                        in_iexact('email', value)
                    )
                elif key == 'username':
                    queryset = queryset.filter(
                        in_iexact('username', value)
                    )

        status = request.GET.get('status')
        if status == 'active':
            queryset = queryset.filter(
                is_active=True,
            )
        elif status == 'disabled':
            queryset = queryset.filter(
                is_active=False,
            )

        order_by = '-date_joined'
        paginator_cls = DateTimePaginator

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=paginator_cls,
        )
