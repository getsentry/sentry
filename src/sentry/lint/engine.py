from __future__ import absolute_import

import os
import pep8
import sys

os.environ['PYFLAKES_NODOCTEST'] = '1'


def register_checks():
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


def py_lint(file_list):
    from flake8.main import DEFAULT_CONFIG
    from flake8.engine import get_style_guide

    # remove non-py files and files which no longer exist
    file_list = filter(lambda x: x.endswith('.py'), file_list)

    flake8_style = get_style_guide(parse_argv=True, config_file=DEFAULT_CONFIG)
    report = flake8_style.check_files(file_list)

    return report.total_errors != 0


def js_lint(file_list):
    has_errors = False
    file_list = filter(lambda x: x.endswith(('.js', '.jsx')), file_list)
    if file_list and os.system('npm run-script lint'):
        has_errors = True

    return has_errors


def check_files(file_list=None):
    # pep8.py uses sys.argv to find setup.cfg
    old_sysargv = sys.argv
    sys.argv = [
        os.path.join(os.path.dirname(__file__), os.pardir, os.pardir, os.pardir)
    ]

    try:
        if not file_list:
            files_to_check = get_files('.')

        else:
            files_to_check = []
            for path in file_list:
                if os.path.isdir(path):
                    files_to_check.extend(get_files(path))
                else:
                    files_to_check.append(path)

        if any((py_lint(files_to_check), js_lint(files_to_check))):
            return 1
        return 0
    finally:
        sys.argv = old_sysargv
