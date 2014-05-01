from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView
from urllib2 import quote

from .authentication import KeyAuthentication
from .paginator import Paginator


LINK_HEADER = '<{uri}&cursor={cursor}>; rel="{name}"'


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
