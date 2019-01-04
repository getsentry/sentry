from __future__ import absolute_import

from sentry.constants import DEFAULT_SORT_OPTION
from sentry.models import Group
from sentry.models.group import looks_like_short_id
from sentry.search.utils import InvalidQuery, parse_query
from sentry.utils.cursors import Cursor


class ValidationError(Exception):
    pass


def build_query_params_from_request(request, projects):
    query_kwargs = {
        'projects': projects,
        'sort_by': request.GET.get('sort', DEFAULT_SORT_OPTION),
    }

    limit = request.GET.get('limit')
    if limit:
        try:
            query_kwargs['limit'] = int(limit)
        except ValueError:
            raise ValidationError('invalid limit')

    # TODO: proper pagination support
    cursor = request.GET.get('cursor')
    if cursor:
        query_kwargs['cursor'] = Cursor.from_string(cursor)

    query = request.GET.get('query', 'is:unresolved').strip()
    if query:
        try:
            query_kwargs.update(parse_query(projects, query, request.user))
        except InvalidQuery as e:
            raise ValidationError(
                u'Your search query could not be parsed: {}'.format(
                    e.message)
            )

    return query_kwargs


def get_by_short_id(organization_id, is_short_id_lookup, query):
    # If the query looks like a short id, we want to provide some
    # information about where that is.  Note that this can return
    # results for another project.  The UI deals with this.
    if is_short_id_lookup == '1' and \
            looks_like_short_id(query):
        try:
            return Group.objects.by_qualified_short_id(
                organization_id, query
            )
        except Group.DoesNotExist:
            pass
