from __future__ import absolute_import

from datetime import datetime, timedelta
from pytz import utc
from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView
from urllib2 import quote

from sentry.tsdb.base import ROLLUPS

from .authentication import KeyAuthentication
from .paginator import Paginator


LINK_HEADER = '<{uri}&cursor={cursor}>; rel="{name}"'

ONE_MINUTE = 60
ONE_HOUR = ONE_MINUTE * 60
ONE_DAY = ONE_HOUR * 24


class Endpoint(APIView):
    authentication_classes = (KeyAuthentication, SessionAuthentication)
    parser_classes = (JSONParser,)

    def paginate(self, request, on_results=lambda x: x, **kwargs):
        input_cursor = request.GET.get('cursor')
        per_page = int(request.GET.get('per_page', 100))

        assert per_page <= 100

        paginator = Paginator(**kwargs)
        cursor = paginator.get_cursor(
            limit=per_page,
            cursor=input_cursor,
        )

        # map results based on callback
        results = on_results(cursor.results)

        links = []
        if cursor.has_prev:
            links.append(('previous', cursor.prev))
        if cursor.has_next:
            links.append(('next', cursor.next))

        querystring = u'&'.join(
            u'{0}={1}'.format(quote(k), quote(v))
            for k, v in request.GET.iteritems()
            if k != 'cursor'
        )
        base_url = request.build_absolute_uri(request.path)
        if querystring:
            base_url = '{0}?{1}'.format(base_url, querystring)
        else:
            base_url = base_url + '?'

        link_values = []
        for name, cursor in links:
            link_values.append(LINK_HEADER.format(
                uri=base_url,
                cursor=cursor,
                name=name,
            ))

        headers = {}
        if link_values:
            headers['Link'] = ', '.join(link_values)

        return Response(results, headers=headers)


class BaseStatsEndpoint(Endpoint):
    def _parse_args(self, request):
        resolution = request.GET.get('resolution')
        if resolution:
            resolution = self._parse_resolution(resolution)

            assert any(r for r in ROLLUPS if r[0] == resolution)

        end = request.GET.get('until')
        if end:
            end = datetime.fromtimestamp(float(end)).replace(tzinfo=utc)
        else:
            end = datetime.utcnow().replace(tzinfo=utc)

        start = request.GET.get('since')
        if start:
            start = datetime.fromtimestamp(float(start)).replace(tzinfo=utc)
        else:
            start = end - timedelta(days=1, seconds=-1)

        return {
            'start': start,
            'end': end,
            'rollup': resolution,
        }

    def _parse_resolution(self, value):
        if value.endswith('h'):
            return int(value[:-1]) * ONE_HOUR
        elif value.endswith('d'):
            return int(value[:-1]) * ONE_DAY
        elif value.endswith('m'):
            return int(value[:-1]) * ONE_MINUTE
        elif value.endswith('s'):
            return int(value[:-1])
        else:
            raise ValueError(value)
