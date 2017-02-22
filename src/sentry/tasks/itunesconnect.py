from __future__ import absolute_import, print_function

import tempfile
import time

from django.conf import settings

from requests.exceptions import Timeout
from sentry import http
from sentry.tasks.base import instrumented_task
from sentry.models import (
    Project, ProjectOption, create_files_from_macho_zip
)


def get_project_from_id(project_id):
    try:
        return Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return


def get_itunes_connect_plugin():
    from sentry.plugins import plugins
    for plugin in plugins:
        if (hasattr(plugin, 'get_task') and plugin.slug == 'itunesconnect'):
            return plugin
    return None


@instrumented_task(name='sentry.tasks.sync_dsyms_from_itunes_connect',
                   time_limit=90,
                   soft_time_limit=60)
def sync_dsyms_from_itunes_connect(**kwargs):
    options = ProjectOption.objects.filter(
        key__in=[
            'itunesconnect:enabled',
            'itunesconnect:email',
            'itunesconnect:password',
        ],
    )
    plugin = get_itunes_connect_plugin()
    for opt in options:
        p = get_project_from_id(opt.project_id)
        # dsym_urls = defaultdict(dict)
        itc = plugin.get_client(p)
        for app in itc.iter_apps():
            for build in itc.iter_app_builds(app['id']):
                fetch_dsym_url.delay(project_id=opt.project_id, app=app, build=build)
                break
            break
    return


@instrumented_task(
    name='sentry.tasks.fetch_dsym_url',
    queue='itunesconnect')
def fetch_dsym_url(project_id, app, build, **kwargs):
    p = get_project_from_id(project_id)
    plugin = get_itunes_connect_plugin()
    itc = plugin.get_client(p)
    url = itc.get_dsym_url(app['id'], build['platform'], build['version'], build['build_id'])
    import pprint
    pprint.pprint(url)
    download_dsym.delay(project_id=project_id, url=url)


@instrumented_task(
    name='sentry.tasks.download_dsym',
    queue='itunesconnect')
def download_dsym(project_id, url, **kwargs):
    p = get_project_from_id(project_id)
    import pprint
    pprint.pprint(p)
    http_session = http.build_session()
    response = None
    try:
        try:
            start = time.time()
            response = http_session.get(
                url,
                allow_redirects=True,
                verify=False,
                timeout=settings.SENTRY_SOURCE_FETCH_SOCKET_TIMEOUT,
                stream=True,
            )

            try:
                cl = int(response.headers['content-length'])
            except (LookupError, ValueError):
                cl = 0
            if cl > settings.SENTRY_SOURCE_FETCH_MAX_SIZE:
                raise OverflowError()

            contents = []
            cl = 0

            # Only need to even attempt to read the response body if we
            # got a 200 OK
            if response.status_code == 200:
                for chunk in response.iter_content(16 * 1024):
                    if time.time() - start > settings.SENTRY_SOURCE_FETCH_TIMEOUT:
                        raise Timeout()
                    contents.append(chunk)
                    cl += len(chunk)
                    if cl > settings.SENTRY_SOURCE_FETCH_MAX_SIZE:
                        raise OverflowError()

        except Exception as exc:
            import pprint
            pprint.pprint(exc)

        body = b''.join(contents)
        temp = tempfile.TemporaryFile()
        try:
            temp.write(body)
            temp.seek(0)
            create_files_from_macho_zip(temp, project=p)
        finally:
            temp.close()

    except Exception as exc:
        import pprint
        pprint.pprint(exc)
