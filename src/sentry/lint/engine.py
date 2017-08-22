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
import subprocess
import json

from subprocess import check_output, Popen
from click import echo, secho, style

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


def get_modified_files(path):
    return [s for s in check_output(
        ['git', 'diff-index', '--cached', '--name-only', 'HEAD']).split('\n') if s]


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
    return sorted(set(files_to_check))


def get_js_files(file_list=None):
    if file_list is None:
        file_list = ['tests/js', 'src/sentry/static/sentry/app']
    return [
        x for x in get_files_for_list(file_list)
        if x.endswith(('.js', '.jsx'))
    ]


def get_python_files(file_list=None):
    if file_list is None:
        file_list = ['src', 'tests']
    return [
        x for x in get_files_for_list(file_list)
        if x.endswith('.py')
    ]


def py_lint(file_list):
    from flake8.engine import get_style_guide

    file_list = get_python_files(file_list)
    flake8_style = get_style_guide(parse_argv=True)
    report = flake8_style.check_files(file_list)

    return report.total_errors != 0


def js_lint(file_list=None):

    project_root = os.path.join(os.path.dirname(__file__), os.pardir, os.pardir,
                                os.pardir)
    eslint_path = os.path.join(project_root, 'node_modules', '.bin', 'eslint')

    if not os.path.exists(eslint_path):
        from click import echo
        echo('!! Skipping JavaScript linting because eslint is not installed.')
        return False

    eslint_config = os.path.join(project_root, '.eslintrc')
    js_file_list = get_js_files(file_list)

    has_errors = False
    if js_file_list:
        status = Popen([eslint_path, '--config', eslint_config, '--ext', '.jsx', '--fix']
                       + js_file_list).wait()
        has_errors = status != 0

    return has_errors


PRETTIER_VERSION = "1.2.2"


def yarn_check(file_list):
    """
    Checks if package.json was modified WITHOUT a corresponding change in the Yarn
    lockfile. This can happen if a user manually edited package.json without running Yarn.

    This is a user prompt right now because there ARE cases where you can touch package.json
    without a Yarn lockfile change, e.g. Jest config changes, license changes, etc.
    """
    if file_list is None or os.environ.get('SKIP_YARN_CHECK'):
        return False

    if 'package.json' in file_list and 'yarn.lock' not in file_list:
        echo(style("""
Warning: package.json modified without accompanying yarn.lock modifications.

If you updated a dependency/devDependency in package.json, you must run `yarn install` to update the lockfile.

To skip this check, run:

$ SKIP_YARN_CHECK=1 git commit [options]""", fg='yellow'))
        return True

    return False


def js_format(file_list=None):
    """
    We only format JavaScript code as part of this pre-commit hook. It is not part
    of the lint engine.
    """
    project_root = os.path.join(os.path.dirname(
        __file__), os.pardir, os.pardir, os.pardir)
    prettier_path = os.path.join(
        project_root, 'node_modules', '.bin', 'prettier')

    if not os.path.exists(prettier_path):
        echo('[sentry.lint] Skipping JavaScript formatting because prettier is not installed.', err=True)
        return False

    # Get Prettier version from package.json
    package_version = None
    package_json_path = os.path.join(project_root, 'package.json')
    with open(package_json_path) as package_json:
        try:
            package_version = json.load(package_json)[
                'devDependencies']['prettier']
        except KeyError:
            echo('!! Prettier missing from package.json', err=True)
            return False

    prettier_version = subprocess.check_output(
        [prettier_path, '--version']).rstrip()
    if prettier_version != package_version:
        echo(
            '[sentry.lint] Prettier is out of date: {} (expected {}). Please run `yarn install`.'.format(
                prettier_version,
                package_version),
            err=True)
        return False

    js_file_list = get_js_files(file_list)

    # manually exclude some bad files
    js_file_list = [x for x in js_file_list if '/javascript/example-project/' not in x]

    return run_formatter([prettier_path,
                          '--write',
                          '--single-quote',
                          '--bracket-spacing=false',
                          '--print-width=90',
                          '--jsx-bracket-same-line=true'],
                         js_file_list)


def py_format(file_list=None):
    try:
        __import__('autopep8')
    except ImportError:
        echo('[sentry.lint] Skipping Python autoformat because autopep8 is not installed.', err=True)
        return False

    py_file_list = get_python_files(file_list)

    return run_formatter(['autopep8', '--in-place', '-j0'], py_file_list)


def run_formatter(cmd, file_list, prompt_on_changes=True):
    if not file_list:
        return False

    has_errors = False

    status = subprocess.Popen(cmd + file_list).wait()
    has_errors = status != 0
    if has_errors:
        return False

    # this is not quite correct, but it at least represents what would be staged
    output = subprocess.check_output(['git', 'diff'] + file_list)
    if output:
        echo('[sentry.lint] applied changes from autoformatting')
        for line in output.splitlines():
            if line.startswith('-'):
                secho(line, fg='red')
            elif line.startswith('+'):
                secho(line, fg='green')
            else:
                echo(line)
        if prompt_on_changes:
            with open('/dev/tty') as fp:
                secho('Stage this patch and continue? [Y/n] ', bold=True)
                if fp.readline().strip().lower() != 'y':
                    echo(
                        '[sentry.lint] Aborted! Changes have been applied but not staged.', err=True)
                    sys.exit(1)
        status = subprocess.Popen(
            ['git', 'update-index', '--add'] + file_list).wait()
        has_errors = status != 0
    return has_errors


def run(file_list=None, format=True, lint=True, js=True, py=True, yarn=True):
    # pep8.py uses sys.argv to find setup.cfg
    old_sysargv = sys.argv

    try:
        sys.argv = [
            os.path.join(os.path.dirname(__file__),
                         os.pardir, os.pardir, os.pardir)
        ]
        results = []

        # packages
        if yarn:
            results.append(yarn_check(file_list))

        # bail early if a deps failed
        if any(results):
            return 1

        if format:
            if py:
                results.append(py_format(file_list))
            if js:
                results.append(js_format(file_list))

        # bail early if a formatter failed
        if any(results):
            return 1

        if lint:
            if py:
                results.append(py_lint(file_list))
            if js:
                results.append(js_lint(file_list))

        if any(results):
            return 1
        return 0
    finally:
        sys.argv = old_sysargv
