"""
Our linter engine needs to run in 3 different scenarios:
 * Linting all files (python, js, less)
 * Linting only python files (--python) [NOTICE: moved to pre-commit]
 * Linting only js files (--js)

For the js only path, we should not depend on any packages outside the
python stdlib to prevent the need to install the world just to run eslint.
"""
from __future__ import absolute_import

import os
import sys
import subprocess

# Import the stdlib json instead of sentry.utils.json, since this command is
# run in setup.py
import json  # NOQA

from subprocess import check_output, Popen

os.environ["PYFLAKES_NODOCTEST"] = "1"
os.environ["SENTRY_PRECOMMIT"] = "1"


def get_project_root():
    return os.path.join(os.path.dirname(__file__), os.pardir, os.pardir, os.pardir)


def get_sentry_bin(name):
    return os.path.join(get_project_root(), "bin", name)


def get_node_modules():
    return os.path.join(get_project_root(), "node_modules")


def get_node_modules_bin(name):
    return os.path.join(get_node_modules(), ".bin", name)


def get_prettier_path():
    return get_node_modules_bin("prettier")


def get_files(path):
    results = []
    for root, _, files in os.walk(path):
        for name in files:
            results.append(os.path.join(root, name))
    return results


def get_modified_files(path):
    return [
        s
        for s in check_output(["git", "diff-index", "--cached", "--name-only", "HEAD"]).split(b"\n")
        if s
    ]


def get_files_for_list(file_list):
    if file_list is None:
        files_to_check = get_files(".")

    else:
        files_to_check = []
        for path in file_list:
            if os.path.isdir(path):
                files_to_check.extend(get_files(path))
            else:
                files_to_check.append(os.path.abspath(path))
    return sorted(set(files_to_check))


def get_js_files(file_list=None, snapshots=False):
    if snapshots:
        extensions = (".js", ".jsx", ".ts", ".tsx", ".jsx.snap", ".js.snap")
    else:
        extensions = (".js", ".jsx", ".ts", ".tsx")

    if file_list is None:
        file_list = ["tests/js", "src/sentry/static/sentry/app"]
    return [x for x in get_files_for_list(file_list) if x.endswith(extensions)]


def get_less_files(file_list=None):
    if file_list is None:
        file_list = ["src/sentry/static/sentry/less", "src/sentry/static/sentry/app"]
    return [x for x in get_files_for_list(file_list) if x.endswith((".less"))]


def js_lint(file_list=None, parseable=False, format=False):

    # We require eslint in path but we actually call an eslint wrapper
    eslint_path = get_node_modules_bin("eslint")

    if not os.path.exists(eslint_path):
        sys.stdout.write("!! Skipping JavaScript linting because eslint is not installed.\n")
        return False

    js_file_list = get_js_files(file_list, snapshots=True)

    has_errors = False
    if js_file_list:
        cmd = [eslint_path, "--ext", ".js,.jsx,.ts,.tsx"]

        if format:
            cmd.append("--fix")
        if parseable:
            cmd.append("--format=checkstyle")

        status = Popen(cmd + js_file_list).wait()
        has_errors = status != 0

    return has_errors


def js_stylelint(file_list=None, parseable=False, format=False):
    """
    stylelint for styled-components
    """

    stylelint_path = get_node_modules_bin("stylelint")

    if not os.path.exists(stylelint_path):
        sys.stdout.write(
            '!! Skipping JavaScript styled-components linting because "stylelint" is not installed.\n'
        )
        return False

    js_file_list = get_js_files(file_list, snapshots=False)

    has_errors = False
    if js_file_list:
        cmd = [stylelint_path]

        status = Popen(cmd + js_file_list).wait()
        has_errors = status != 0

    return has_errors


def yarn_check(file_list):
    """
    Checks if package.json was modified WITHOUT a corresponding change in the Yarn
    lockfile. This can happen if a user manually edited package.json without running Yarn.

    This is a user prompt right now because there ARE cases where you can touch package.json
    without a Yarn lockfile change, e.g. Jest config changes, license changes, etc.
    """

    if file_list is None or os.environ.get("SKIP_YARN_CHECK"):
        return False

    if "package.json" in file_list and "yarn.lock" not in file_list:
        sys.stdout.write(
            "\033[33m"
            + """Warning: package.json modified without accompanying yarn.lock modifications.

If you updated a dependency/devDependency in package.json, you must run `yarn install` to update the lockfile.

To skip this check, run `SKIP_YARN_CHECK=1 git commit [options]`"""
            + "\033[0m"
            + "\n"
        )
        return True

    return False


def is_prettier_valid(project_root, prettier_path):
    if not os.path.exists(prettier_path):
        sys.stderr.write(
            "[sentry.lint] Skipping JavaScript formatting because prettier is not installed.\n"
        )
        return False

    # Get Prettier version from package.json
    package_version = None
    package_json_path = os.path.join(project_root, "package.json")
    with open(package_json_path) as package_json:
        try:
            package_version = json.load(package_json)["devDependencies"]["prettier"]
        except KeyError:
            sys.stderr.write("!! Prettier missing from package.json\n")
            return False

    prettier_version = subprocess.check_output([prettier_path, "--version"]).decode("utf8").rstrip()
    if prettier_version != package_version:
        sys.stderr.write(
            u"[sentry.lint] Prettier is out of date: {} (expected {}). Please run `yarn install`.\n".format(
                prettier_version, package_version
            )
        )
        return False

    return True


def js_lint_format(file_list=None):
    """
    We only format JavaScript code as part of this pre-commit hook. It is not part
    of the lint engine. This uses eslint's `--fix` formatting feature.
    """
    eslint_path = get_node_modules_bin("eslint")
    project_root = get_project_root()
    prettier_path = get_prettier_path()

    if not os.path.exists(eslint_path):
        sys.stdout.write(
            "!! Skipping JavaScript linting and formatting because eslint is not installed.\n"
        )
        return False

    if not is_prettier_valid(project_root, prettier_path):
        return False

    js_file_list = get_js_files(file_list)

    # manually exclude some bad files
    js_file_list = [x for x in js_file_list if "/javascript/example-project/" not in x]
    cmd = [eslint_path, "--fix"]

    has_package_json_errors = (
        False
        if "package.json" not in file_list
        else run_formatter([prettier_path, "--write"], ["package.json"])
    )

    has_errors = run_formatter(cmd, js_file_list)

    return has_errors or has_package_json_errors


def js_test(file_list=None):
    """
    Run JavaScript unit tests on relevant files ONLY as part of pre-commit hook
    """
    jest_path = get_node_modules_bin("jest")

    if not os.path.exists(jest_path):
        sys.stdout.write(
            "[sentry.test] Skipping JavaScript testing because jest is not installed.\n"
        )
        return False

    js_file_list = get_js_files(file_list)

    has_errors = False
    if js_file_list:
        status = Popen(["yarn", "test-precommit"] + js_file_list).wait()
        has_errors = status != 0

    return has_errors


def less_format(file_list=None):
    """
    We only format less code as part of this pre-commit hook. It is not part
    of the lint engine.
    """
    project_root = get_project_root()
    prettier_path = get_prettier_path()

    if not is_prettier_valid(project_root, prettier_path):
        return False

    less_file_list = get_less_files(file_list)
    return run_formatter([prettier_path, "--write"], less_file_list)


def run_formatter(cmd, file_list, prompt_on_changes=True):
    if not file_list:
        return False

    has_errors = False

    status = subprocess.Popen(cmd + file_list).wait()
    has_errors = status != 0
    if has_errors:
        return True

    # this is not quite correct, but it at least represents what would be staged
    output = subprocess.check_output(["git", "diff", "--color"] + file_list)
    if output:
        sys.stdout.write("[sentry.lint] applied changes from autoformatting\n")
        sys.stdout.write(output)
        if prompt_on_changes:
            with open("/dev/tty") as fp:
                sys.stdout.write("\033[1m" + "Stage this patch and continue? [Y/n] " + "\033[0m\n")
                if fp.readline().strip() not in ("Y", "y", ""):
                    sys.stderr.write("[sentry.lint] Unstaged changes have not been staged.\n")
                    if not os.environ.get("SENTRY_SKIP_FORCE_PATCH"):
                        sys.stderr.write("[sentry.lint] Aborted!\n")
                        sys.exit(1)
                else:
                    status = subprocess.Popen(["git", "update-index", "--add"] + file_list).wait()
        has_errors = status != 0
    return has_errors


def run(
    file_list=None,
    format=True,
    lint=True,
    js=True,
    py=True,
    less=True,
    yarn=True,
    test=False,
    parseable=False,
):
    old_sysargv = sys.argv

    try:
        sys.argv = [os.path.join(os.path.dirname(__file__), os.pardir, os.pardir, os.pardir)]
        results = []

        # packages
        if yarn:
            results.append(yarn_check(file_list))

        # bail early if a deps failed
        if any(results):
            return 1

        if format:
            if py:
                # python autoformatting is now done via pre-commit (black)
                pass
            if js:
                # run eslint with --fix and skip these linters down below
                results.append(js_lint_format(file_list))
            if less:
                results.append(less_format(file_list))

        # bail early if a formatter failed
        if any(results):
            return 1

        if lint:
            if py:
                pass  # flake8 linting was moved to pre-commit
            if js:
                # stylelint `--fix` doesn't work well
                results.append(js_stylelint(file_list, parseable=parseable, format=format))

                if not format:
                    # these tasks are called when we need to format, so skip it here
                    results.append(js_lint(file_list, parseable=parseable, format=format))

        if test:
            if js:
                results.append(js_test(file_list))

        if any(results):
            return 1
        return 0
    finally:
        sys.argv = old_sysargv
