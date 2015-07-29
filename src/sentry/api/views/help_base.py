from __future__ import absolute_import

import re
import textwrap

from django.utils.importlib import import_module
from django.utils.text import slugify

from sentry.api.base import Endpoint
from sentry.constants import HTTP_METHODS
from sentry.web.frontend.base import BaseView

optional_group_matcher = re.compile(r'\(\?\:(.+)\)')
named_group_matcher = re.compile(r'\(\?P<(\w+)>[^\)]+\)')
non_named_group_matcher = re.compile(r'\(.*?\)')


def simplify_regex(pattern):
    """
    Clean up urlpattern regexes into something somewhat readable by Mere Humans:
    turns something like "^(?P<sport_slug>\w+)/athletes/(?P<athlete_slug>\w+)/$"
    into "{sport_slug}/athletes/{athlete_slug}/"
    """
    pattern = optional_group_matcher.sub(lambda m: '[%s]' % m.group(1), pattern)

    # handle named groups first
    pattern = named_group_matcher.sub(lambda m: '{%s}' % m.group(1), pattern)

    # handle non-named groups
    pattern = non_named_group_matcher.sub("{var}", pattern)

    # clean up any outstanding regex-y characters.
    pattern = pattern.replace('^', '').replace('$', '').replace('?', '').replace('//', '/').replace('\\', '')
    if not pattern.startswith('/'):
        pattern = '/' + pattern
    return pattern


class ApiHelpBase(BaseView):
    auth_required = False

    def get_resources(self, section, prefix='/api/0/'):
        urls = import_module('sentry.api.urls')

        resources = []
        for pattern in urls.urlpatterns:
            callback = self.__get_resource_callback(pattern, prefix)
            if callback is None:
                continue
            if getattr(callback, 'doc_section', None) != section:
                continue
            data = self.__get_resource_data(pattern, prefix, callback)
            resources.append(data)
        return sorted(resources, key=lambda x: x['path'])

    def get_sections(self, prefix=''):
        resource_list = sorted(
            (r for r in self.get_resources(prefix) if r['section']),
            key=lambda x: x['section'].value,
        )

        section_list = []
        last_section = None
        for resource in resource_list:
            if resource['section'] != last_section:
                section_list.append({
                    'id': resource['section'].name,
                    'name': resource['section'].value,
                    'resources': [],
                })
            section_list[-1]['resources'].append(resource)
            last_section = resource['section']

        return section_list

    def __split_doc(self, doc, path):
        if doc:
            try:
                title, doc = textwrap.dedent(doc).strip().split('\n', 1)
            except ValueError:
                title, doc = doc, ''
        else:
            title = ''

        return title.strip(), doc.strip()

    def __format_doc(self, doc, params):
        return doc.format(**params)

    def __title_to_anchor(self, title):
        return slugify(title.decode('utf-8'))

    def __get_resource_callback(self, pattern, prefix):
        if not hasattr(pattern, 'callback'):
            return

        if hasattr(pattern.callback, 'cls'):
            callback = pattern.callback.cls

            if not issubclass(callback, Endpoint):
                return
        elif hasattr(pattern.callback, 'cls_instance'):
            callback = pattern.callback.cls_instance

            if not isinstance(callback, Endpoint):
                return
        else:
            return

        return callback

    def __get_resource_data(self, pattern, prefix, callback):
        path = simplify_regex(pattern.regex.pattern)

        full_path = prefix.rstrip('/') + path

        methods = []
        for method_name in HTTP_METHODS:
            if method_name == 'OPTIONS':
                continue
            method = getattr(callback, method_name.lower(), None)
            if method is None:
                continue

            title, docstring = self.__split_doc(method.__doc__ or '', path=path)

            if not title:
                title = '{} {}'.format(method_name, path)

            methods.append({
                'verb': method_name,
                'path': full_path,
                'title': title,
                'anchor': self.__title_to_anchor(title),
                'doc': self.__format_doc(docstring, {
                    'path': full_path,
                    'method': method_name,
                }),
            })

        return {
            'path': full_path,
            'methods': methods,
            'section': getattr(callback, 'doc_section', None),
        }
