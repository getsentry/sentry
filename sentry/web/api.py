"""
sentry.web.views
~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from sentry.coreapi import (extract_auth_vars, project_from_auth_vars, project_from_api_key_and_id,
                            project_from_id, decode_and_decompress_data, safely_load_json_string,
                            ensure_valid_project_id, insert_data_to_database, APIError, APIUnauthorized)

@csrf_exempt
@require_http_methods(['POST'])
def store(request):
    try:
        auth_vars = extract_auth_vars(request)
        data = request.raw_post_data

        if auth_vars:
            project = project_from_auth_vars(auth_vars, data)
        elif request.GET.get('api_key') and request.GET.get('project_id') and request.is_secure():
            # ssl requests dont have to have signature verification
            project = project_from_api_key_and_id(request.GET['api_key'], request.GET['project_id'])
        elif request.GET.get('project_id') and request.user.is_authenticated():
            # authenticated users are simply trusted to provide the right id
            project = project_from_id(request)
        else:
            raise APIUnauthorized()

        if not data.startswith('{'):
            data = decode_and_decompress_data(data)
        data = safely_load_json_string(data)

        ensure_valid_project_id(project, data)

        insert_data_to_database(data)
    except APIError, error:
        return HttpResponse(error.msg, status=error.http_status)
    return HttpResponse('')
    
