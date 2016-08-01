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
    import pycodestyle

    from sentry.lint.sentry_check import SentryCheck

    pycodestyle.register_check(SentryCheck)


register_checks()


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
                files_to_check.append(os.path.abspath(path))
    return files_to_check


def py_lint(file_list):
    from flake8.engine import get_style_guide

    if file_list is None:
        file_list = ['src/sentry', 'tests']
    file_list = get_files_for_list(file_list)

    # remove non-py files and files which no longer exist
    file_list = [x for x in file_list if x.endswith('.py')]

    flake8_style = get_style_guide(parse_argv=True)
    report = flake8_style.check_files(file_list)

    return report.total_errors != 0


def js_lint(file_list=None):
    project_root = os.path.join(os.path.dirname(__file__), os.pardir, os.pardir,
                                os.pardir)
    eslint_path = os.path.join(project_root, 'node_modules', '.bin', 'eslint')

    if not os.path.exists(eslint_path):
        print('!! Skipping JavaScript linting because eslint is not installed.')
        return False

    if file_list is None:
        file_list = ['tests/js', 'src/sentry/static/sentry/app']
    file_list = get_files_for_list(file_list)

    eslint_config = os.path.join(project_root, '.eslintrc')

    has_errors = False
    file_list = [
        x for x in file_list
        if x.endswith(('.js', '.jsx'))
    ]

    if file_list:
        status = Popen([eslint_path, '--config', eslint_config, '--ext', '.jsx']
                       + file_list).wait()
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
