#!/usr/bin/env python
# -*- coding: utf-8 -*-
'''\
usage: venv-update [-hV] [options]

Update a (possibly non-existent) virtualenv directory using a pip requirements
file.  When this script completes, the virtualenv directory should contain the
same packages as if it were deleted then rebuilt.

venv-update uses "trailing equal" options (e.g. venv=) to delimit groups of
(conventional, dashed) options to pass to wrapped commands (virtualenv and pip).

Options:
    venv=             parameters are passed to virtualenv
                       default: {venv=}
    install=          options to pip-command
                       default: {install=}
    pip-command=      is run after the virtualenv directory is bootstrapped
                       default: {pip-command=}
    bootstrap-deps=   dependencies to install before pip-command= is run
                       default: {bootstrap-deps=}

Examples:
    # install requirements.txt to "venv"
    venv-update

    # install requirements.txt to "myenv"
    venv-update venv= myenv

    # install requirements.txt to "myenv" using Python 3.4
    venv-update venv= -ppython3.4 myenv

    # install myreqs.txt to "venv"
    venv-update install= -r myreqs.txt

    # install requirements.txt to "venv", verbosely
    venv-update venv= venv -vvv install= -r requirements.txt -vvv

    # install requirements.txt to "venv", without pip-faster --update --prune
    venv-update pip-command= pip install

We strongly recommend that you keep the default value of pip-command= in order
to quickly and reproducibly install your requirements. You can override the
packages installed during bootstrapping, prior to pip-command=, by setting
bootstrap-deps=

Pip options are also controllable via environment variables.
See https://pip.readthedocs.org/en/stable/user_guide/#environment-variables
For example:
    PIP_INDEX_URL=https://pypi.example.com/simple venv-update

Please send issues to: https://github.com/yelp/venv-update
'''
from __future__ import absolute_import
from __future__ import print_function
from __future__ import unicode_literals

import os
from os.path import exists
from os.path import join
from subprocess import CalledProcessError

# https://github.com/Yelp/venv-update/issues/227
# https://stackoverflow.com/a/53193892
# On OS X, Python "framework" builds set a `__PYVENV_LAUNCHER__` environment
# variable when executed, which gets inherited by child processes and cause
# certain Python builds to put incorrect packages onto their path. This causes
# weird bugs with venv-update like import errors calling pip and infinite
# exec() loops trying to activate a virtualenv.
#
# To fix this we just delete the environment variable.
os.environ.pop('__PYVENV_LAUNCHER__', None)

__version__ = '3.2.4'
DEFAULT_VIRTUALENV_PATH = 'venv'
DEFAULT_OPTION_VALUES = {
    'venv=': (DEFAULT_VIRTUALENV_PATH,),
    'install=': ('-r', 'requirements.txt',),
    'pip-command=': ('pip-faster', 'install', '--upgrade', '--prune'),
    'bootstrap-deps=': ('venv-update==' + __version__,),
}
__doc__ = __doc__.format(
    **{key: ' '.join(val) for key, val in DEFAULT_OPTION_VALUES.items()}
)

# This script must not rely on anything other than
#   stdlib>=2.6 and virtualenv>1.11


def parseargs(argv):
    '''handle --help, --version and our double-equal ==options'''
    args = []
    options = {}
    key = None
    for arg in argv:
        if arg in DEFAULT_OPTION_VALUES:
            key = arg.strip('=').replace('-', '_')
            options[key] = ()
        elif key is None:
            args.append(arg)
        else:
            options[key] += (arg,)

    if set(args) & {'-h', '--help'}:
        print(__doc__, end='')
        exit(0)
    elif set(args) & {'-V', '--version'}:
        print(__version__)
        exit(0)
    elif args:
        exit('invalid option: %s\nTry --help for more information.' % args[0])

    return options


def timid_relpath(arg):
    """convert an argument to a relative path, carefully"""
    # TODO-TEST: unit tests
    from os.path import isabs, relpath, sep
    if isabs(arg):
        result = relpath(arg)
        if result.count(sep) + 1 < arg.count(sep):
            return result

    return arg


def shellescape(args):
    from pipes import quote
    return ' '.join(quote(timid_relpath(arg)) for arg in args)


def colorize(cmd):
    from os import isatty

    if isatty(1):
        template = '\033[36m>\033[m \033[32m{0}\033[m'
    else:
        template = '> {0}'

    return template.format(shellescape(cmd))


def run(cmd):
    from subprocess import check_call
    check_call(('echo', colorize(cmd)))
    check_call(cmd)


def info(msg):
    # use a subprocess to ensure correct output interleaving.
    from subprocess import check_call
    check_call(('echo', msg))


def check_output(cmd):
    from subprocess import Popen, PIPE
    process = Popen(cmd, stdout=PIPE)
    output, _ = process.communicate()
    if process.returncode:
        raise CalledProcessError(process.returncode, cmd)
    else:
        assert process.returncode == 0
        return output.decode('UTF-8')


def samefile(file1, file2):
    if not exists(file1) or not exists(file2):
        return False
    else:
        from os.path import samefile
        return samefile(file1, file2)


def exec_(argv):  # never returns
    """Wrapper to os.execv which shows the command and runs any atexit handlers (for coverage's sake).
    Like os.execv, this function never returns.
    """
    # info('EXEC' + colorize(argv))  # TODO: debug logging by environment variable

    # in python3, sys.exitfunc has gone away, and atexit._run_exitfuncs seems to be the only pubic-ish interface
    #   https://hg.python.org/cpython/file/3.4/Modules/atexitmodule.c#l289
    import atexit
    atexit._run_exitfuncs()

    from os import execv
    execv(argv[0], argv)


class Scratch(object):

    def __init__(self):
        self.dir = join(user_cache_dir(), 'venv-update', __version__)
        self.venv = join(self.dir, 'venv')
        self.python = venv_python(self.venv)
        self.src = join(self.dir, 'src')


def exec_scratch_virtualenv(args):
    """
    goals:
        - get any random site-packages off of the pythonpath
        - ensure we can import virtualenv
        - ensure that we're not using the interpreter that we may need to delete
        - idempotency: do nothing if the above goals are already met
    """
    scratch = Scratch()
    if not exists(scratch.python):
        run(('virtualenv', scratch.venv))

    if not exists(join(scratch.src, 'virtualenv.py')):
        scratch_python = venv_python(scratch.venv)
        # TODO: do we allow user-defined override of which version of virtualenv to install?
        # https://github.com/Yelp/venv-update/issues/231 virtualenv 20+ is not supported.
        tmp = scratch.src + '.tmp'
        run((scratch_python, '-m', 'pip.__main__', 'install', 'virtualenv<20', '--target', tmp))

        from os import rename
        rename(tmp, scratch.src)

    import sys
    from os.path import realpath
    # We want to compare the paths themselves as sometimes sys.path is the same
    # as scratch.venv, but with a suffix of bin/..
    if realpath(sys.prefix) != realpath(scratch.venv):
        # TODO-TEST: sometimes we would get a stale version of venv-update
        exec_((scratch.python, dotpy(__file__)) + args)  # never returns

    # TODO-TEST: the original venv-update's directory was on sys.path (when using symlinking)
    sys.path[0] = scratch.src


def get_original_path(venv_path):  # TODO-TEST: a unit test
    """This helps us know whether someone has tried to relocate the virtualenv"""
    return check_output(('sh', '-c', '. %s; printf "$VIRTUAL_ENV"' % venv_executable(venv_path, 'activate')))


def has_system_site_packages(interpreter):
    # TODO: unit-test
    system_site_packages = check_output((
        interpreter,
        '-c',
        # stolen directly from virtualenv's site.py
        """\
import site, os.path
print(
    0
    if os.path.exists(
        os.path.join(os.path.dirname(site.__file__), 'no-global-site-packages.txt')
    ) else
    1
)"""
    ))
    system_site_packages = int(system_site_packages)
    assert system_site_packages in (0, 1)
    return bool(system_site_packages)


def get_python_version(interpreter):
    if not exists(interpreter):
        return None

    cmd = (interpreter, '-c', 'import sys; print(sys.version)')
    return check_output(cmd)


def invalid_virtualenv_reason(venv_path, source_python, destination_python, options):
    try:
        orig_path = get_original_path(venv_path)
    except CalledProcessError:
        return 'could not inspect metadata'
    if not samefile(orig_path, venv_path):
        return 'virtualenv moved {} -> {}'.format(timid_relpath(orig_path), timid_relpath(venv_path))
    elif has_system_site_packages(destination_python) != options.system_site_packages:
        return 'system-site-packages changed, to %s' % options.system_site_packages

    if source_python is None:
        return
    destination_version = get_python_version(destination_python)
    source_version = get_python_version(source_python)
    if source_version != destination_version:
        return 'python version changed {} -> {}'.format(destination_version, source_version)


def ensure_virtualenv(args, return_values):
    """Ensure we have a valid virtualenv."""
    def adjust_options(options, args):
        # TODO-TEST: proper error message with no arguments
        venv_path = return_values.venv_path = args[0]

        if venv_path == DEFAULT_VIRTUALENV_PATH or options.prompt == '<dirname>':
            from os.path import abspath, basename, dirname
            options.prompt = '(%s)' % basename(dirname(abspath(venv_path)))
        # end of option munging.

        # there are two python interpreters involved here:
        # 1) the interpreter we're instructing virtualenv to copy
        if options.python is None:
            source_python = None
        else:
            source_python = virtualenv.resolve_interpreter(options.python)
        # 2) the interpreter virtualenv will create
        destination_python = venv_python(venv_path)

        if exists(destination_python):
            reason = invalid_virtualenv_reason(venv_path, source_python, destination_python, options)
            if reason:
                info('Removing invalidated virtualenv. (%s)' % reason)
                run(('rm', '-rf', venv_path))
            else:
                info('Keeping valid virtualenv from previous run.')
                raise SystemExit(0)  # looks good! we're done here.

    # this is actually a documented extension point:
    #   http://virtualenv.readthedocs.org/en/latest/reference.html#adjust_options
    import virtualenv
    virtualenv.adjust_options = adjust_options

    from sys import argv
    argv[:] = ('virtualenv',) + args
    info(colorize(argv))
    raise_on_failure(virtualenv.main)
    # There might not be a venv_path if doing something like "venv= --version"
    # and not actually asking virtualenv to make a venv.
    if return_values.venv_path is not None:
        run(('rm', '-rf', join(return_values.venv_path, 'local')))


def wait_for_all_subprocesses():
    from os import wait
    try:
        while True:
            wait()
    except OSError as error:
        if error.errno == 10:  # no child processes
            return
        else:
            raise


def touch(filename, timestamp):
    """set the mtime of a file"""
    if timestamp is not None:
        timestamp = (timestamp, timestamp)  # atime, mtime

    from os import utime
    utime(filename, timestamp)


def mark_venv_valid(venv_path):
    wait_for_all_subprocesses()
    touch(venv_path, None)


def mark_venv_invalid(venv_path):
    # LBYL, to attempt to avoid any exception during exception handling
    from os.path import isdir
    if venv_path and isdir(venv_path):
        info('')
        info("Something went wrong! Sending '%s' back in time, so make knows it's invalid." % timid_relpath(venv_path))
        wait_for_all_subprocesses()
        touch(venv_path, 0)


def dotpy(filename):
    if filename.endswith(('.pyc', '.pyo', '.pyd')):
        return filename[:-1]
    else:
        return filename


def venv_executable(venv_path, executable):
    return join(venv_path, 'bin', executable)


def venv_python(venv_path):
    return venv_executable(venv_path, 'python')


def user_cache_dir():
    # stolen from pip.utils.appdirs.user_cache_dir
    from os import getenv
    from os.path import expanduser
    return getenv('XDG_CACHE_HOME', expanduser('~/.cache'))


def venv_update(
        venv=DEFAULT_OPTION_VALUES['venv='],
        install=DEFAULT_OPTION_VALUES['install='],
        pip_command=DEFAULT_OPTION_VALUES['pip-command='],
        bootstrap_deps=DEFAULT_OPTION_VALUES['bootstrap-deps='],
):
    """we have an arbitrary python interpreter active, (possibly) outside the virtualenv we want.

    make a fresh venv at the right spot, make sure it has pip-faster, and use it
    """

    # SMELL: mutable argument as return value
    class return_values(object):
        venv_path = None

    try:
        ensure_virtualenv(venv, return_values)
        if return_values.venv_path is None:
            return
        # invariant: the final virtualenv exists, with the right python version
        raise_on_failure(lambda: pip_faster(return_values.venv_path, pip_command, install, bootstrap_deps))
    except BaseException:
        mark_venv_invalid(return_values.venv_path)
        raise
    else:
        mark_venv_valid(return_values.venv_path)


def execfile_(filename):
    with open(filename) as code:
        code = compile(code.read(), filename, 'exec')
        exec(code, {'__file__': filename})


def pip_faster(venv_path, pip_command, install, bootstrap_deps):
    """install and run pip-faster"""
    # activate the virtualenv
    execfile_(venv_executable(venv_path, 'activate_this.py'))

    # disable a useless warning
    # FIXME: ensure a "true SSLContext" is available
    from os import environ
    environ['PIP_DISABLE_PIP_VERSION_CHECK'] = '1'

    # we always have to run the bootstrap, because the presense of an
    # executable doesn't imply the right version. pip is able to validate the
    # version in the fastpath case quickly anyway.
    run(('pip', 'install') + bootstrap_deps)

    run(pip_command + install)


def raise_on_failure(mainfunc):
    """raise if and only if mainfunc fails"""
    try:
        errors = mainfunc()
        if errors:
            exit(errors)
    except CalledProcessError as error:
        exit(error.returncode)
    except SystemExit as error:
        if error.code:
            raise
    except KeyboardInterrupt:  # I don't plan to test-cover this.  :pragma:nocover:
        exit(1)


def main():
    from sys import argv
    args = tuple(argv[1:])

    # process --help before we create any side-effects.
    options = parseargs(args)
    exec_scratch_virtualenv(args)
    return venv_update(**options)


if __name__ == '__main__':
    exit(main())
