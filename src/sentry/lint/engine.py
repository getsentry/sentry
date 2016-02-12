"""
Our linter engine needs to run in 3 different scenarios:
 * Linting all files (python and js)
 * Linting only python files (--python)
 * Linting only js files (--js)

For the js only path, we should not depend on any packages outside the
python stdlib to prevent the need to install the world just to run eslint.

This also means imports should be done lazily/inside of function calls for
dependencies such as flake8/pep8.
"""
from __future__ import absolute_import

import os
import sys
from subprocess import Popen

os.environ['PYFLAKES_NODOCTEST'] = '1'


def register_checks():
    import pep8
    from sentry.lint.absolute_import_check import AbsoluteImportCheck
    from sentry.lint.mock_check import MockCheck

    pep8.register_check(MockCheck, codes=[MockCheck.code])
    pep8.register_check(AbsoluteImportCheck, codes=[AbsoluteImportCheck.code])


def get_files(path):
    results = []
    for root, _, files in os.walk(path):
        for name in files:
            results.append(os.path.join(root, name))
    return results


def get_files_for_list(file_list):
    if file_list is None:
        files_to_check = get_files('.')

    else:
        files_to_check = []
        for path in file_list:
            if os.path.isdir(path):
                files_to_check.extend(get_files(path))
            else:
                files_to_check.append(path)
    return files_to_check


def py_lint(file_list):
    from flake8.main import DEFAULT_CONFIG
    from flake8.engine import get_style_guide

    if file_list is None:
        file_list = ['src/sentry', 'tests']
    file_list = get_files_for_list(file_list)

    # remove non-py files and files which no longer exist
    file_list = filter(lambda x: x.endswith('.py'), file_list)

    flake8_style = get_style_guide(parse_argv=True, config_file=DEFAULT_CONFIG)
    report = flake8_style.check_files(file_list)

    return report.total_errors != 0


def js_lint(file_list=None):
    if not os.path.exists('node_modules/.bin/eslint'):
        print '!! Skipping JavaScript linting because eslint is not installed.'
        return False
    if file_list is None:
        file_list = ['tests/js', 'src/sentry/static/sentry/app']
    file_list = get_files_for_list(file_list)

    has_errors = False
    file_list = filter(lambda x: x.endswith(('.js', '.jsx')), file_list)
    if file_list:
        status = Popen(['node_modules/.bin/eslint', '--ext', '.jsx']
                       + list(file_list)).wait()
        has_errors = status != 0

    return has_errors


def check_files(file_list=None, js=True, py=True):
    # pep8.py uses sys.argv to find setup.cfg
    old_sysargv = sys.argv
    sys.argv = [
        os.path.join(os.path.dirname(__file__), os.pardir, os.pardir, os.pardir)
    ]

    linters = []
    if py:
        linters.append(py_lint(file_list))
    if js:
        linters.append(js_lint(file_list))

    try:
        if any(linters):
            return 1
        return 0
    finally:
        sys.argv = old_sysargv
