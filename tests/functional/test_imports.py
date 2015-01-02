from __future__ import absolute_import

import fnmatch
import os

from subprocess import call


ROOT = os.path.normpath(
    os.path.join(os.path.dirname(__file__), os.pardir, os.pardir, 'src'))


def _find_files(root, pattern='*'):
    matches = []
    for root, _, filenames in os.walk(root):
        for filename in fnmatch.filter(filenames, pattern):
            matches.append(os.path.join(root, filename))
    return matches


def _generate_tests():
    string = 'from __future__ import absolute_import'

    kwargs = {
        'stdout': open('/dev/null', 'a'),
        'stderr': open('/dev/null', 'a'),
    }

    def make_test(filename, relpath):
        def test():
            assert not call(['grep', string, filename], **kwargs), \
                "Missing %r in %s" % (string, relpath)

        test.__doc__ = relpath
        test.__name__ = 'test_' + relpath.replace('/', '_').rstrip('.py')

        return test

    for filename in _find_files(ROOT, '*.py'):
        relpath = filename[len(ROOT) - 3:]

        if '/migrations/' in relpath:
            continue

        if relpath.startswith('src/sentry/static/'):
            continue

        func = make_test(filename, relpath)

        globals()[func.__name__] = func

_generate_tests()
