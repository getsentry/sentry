from __future__ import absolute_import

import six
import posixpath
from collections import OrderedDict

LANGUAGES = OrderedDict()
PLATFORMS = OrderedDict()


def register_lang(id, name, base=None, platform=False, extensions=None):
    if platform:
        register_platform(id, name, default_lang=id)
    LANGUAGES[id] = {
        'id': id,
        'name': name,
        'platform': platform,
        'extensions': frozenset(extensions or ()),
    }


def register_platform(id, name, default_lang=None):
    PLATFORMS[id] = {
        'id': id,
        'name': name,
        'default_lang': default_lang,
    }


def get_language_from_filename(filename):
    extension = posixpath.splitext(filename)
    if extension:
        extension = extension.lstrip('.')
        for lang in six.itervalues(PLATFORMS):
            if extension in lang['extensions']:
                return lang['id']
    return 'other'


def get_language_from_platform(platform):
    plat = PLATFORMS.get(platform)
    if plat and plat['default_lang']:
        return plat['default_lang']
    return 'other'


def infer_language(filename=None, platform=None):
    """Infers the language from the give filename or platform"""
    if filename:
        filename_match = get_language_from_filename(filename)
        if filename_match != 'other':
            return filename_match
    if platform:
        return get_language_from_platform(platform)
    return 'other'


# Languages that have platforms
register_lang('c', 'C', base='native', platform=True, extensions=['c', 'h'])
register_lang('csharp', 'C#', platform=True, extensions=['cs'])
register_lang('elixir', 'Elixir', base='erlang', platform=True, extensions=['ex', 'exs'])
register_lang('erlang', 'Erlang', platform=True, extensions=['erl'])
register_lang('go', 'Go', platform=True, extensions=['go'])
register_lang('groovy', 'Groovy', platform=True, extensions=['groovy'])
register_lang('haskell', 'Haskell', platform=True, extensions=['hs', 'lhs'])
register_lang('java', 'Java', platform=True, extensions=['java'])
register_lang('javascript', 'JavaScript', platform=True, extensions=['js', 'jsx'])
register_lang('objc', 'Objective-C', platform=True, extensions=['m'])
register_lang('perl', 'Perl', platform=True, extensions=['pl'])
register_lang('php', 'PHP', platform=True, extensions=['php', 'php3', 'php4', 'php5'])
register_lang('python', 'Python', platform=True, extensions=['py'])
register_lang('ruby', 'Ruby', platform=True, extensions=['rb'])

# Fallback platform and language
register_lang('other', 'Other', platform=True)

# Legacy languages and platforms
register_lang('as3', 'ActionScript', base='javascript', platform=True)
register_lang('cfml', 'ColdFusion Markup Language', platform=True)

# Languages that are specializations of others
register_lang('typescript', 'TypeScript', base='javascript', extensions=['ts'])
register_lang('cpp', 'C++', base='c', extensions=['cpp'])
register_lang('rust', 'Rust', base='native', extensions=['rs'])
register_lang('swift', 'Swift', base='native', extensions=['swift'])
register_lang('scala', 'Scala', base='java', extensions=['scala'])

# Platforms that have a default language
register_platform('cocoa', 'Cocoa', default_lang='objc')
register_platform('node', 'Node', default_lang='javascript')
register_platform('dotnet', '.NET', default_lang='csharp')
