from __future__ import absolute_import

import os
import os.path
import shutil
import sys

from distutils import log
from subprocess import check_output
from distutils.core import Command


class BaseBuildCommand(Command):
    user_options = [
        ('work-path=', 'w',
         "The working directory for source files. Defaults to ."),
        ('build-lib=', 'b',
         "directory for script runtime modules"),
        ('inplace', 'i',
         "ignore build-lib and put compiled javascript files into the source " +
         "directory alongside your pure Python modules"),
        ('force', 'f',
         "Force rebuilding of static content. Defaults to rebuilding on version "
         "change detection."),
    ]

    boolean_options = ['force']

    def initialize_options(self):
        self.build_lib = None
        self.force = None
        self.work_path = None
        self.inplace = None

    def get_root_path(self):
        return os.path.abspath(os.path.dirname(sys.modules['__main__'].__file__))

    def get_dist_paths(self):
        return []

    def get_manifest_additions(self):
        return []

    def finalize_options(self):
        # This requires some explanation.  Basically what we want to do
        # here is to control if we want to build in-place or into the
        # build-lib folder.  Traditionally this is set by the `inplace`
        # command line flag for build_ext.  However as we are a subcommand
        # we need to grab this information from elsewhere.
        #
        # An in-place build puts the files generated into the source
        # folder, a regular build puts the files into the build-lib
        # folder.
        #
        # The following situations we need to cover:
        #
        #   command                         default in-place
        #   setup.py build_js               0
        #   setup.py build_ext              value of in-place for build_ext
        #   setup.py build_ext --inplace    1
        #   pip install --editable .        1
        #   setup.py install                0
        #   setup.py sdist                  0
        #   setup.py bdist_wheel            0
        #
        # The way this is achieved is that build_js is invoked by two
        # subcommands: bdist_ext (which is in our case always executed
        # due to a custom distribution) or sdist.
        #
        # Note: at one point install was an in-place build but it's not
        # quite sure why.  In case a version of install breaks again:
        # installations via pip from git URLs definitely require the
        # in-place flag to be disabled.  So we might need to detect
        # that separately.
        #
        # To find the default value of the inplace flag we inspect the
        # sdist and build_ext commands.
        sdist = self.distribution.get_command_obj('sdist')
        build_ext = self.get_finalized_command('build_ext')

        # If we are not decided on in-place we are inplace if either
        # build_ext is inplace or we are invoked through the install
        # command (easiest check is to see if it's finalized).
        if self.inplace is None:
            self.inplace = (build_ext.inplace or sdist.finalized) and 1 or 0

        # If we're coming from sdist, clear the hell out of the dist
        # folder first.
        if sdist.finalized:
            for path in self.get_dist_paths():
                try:
                    shutil.rmtree(path)
                except (OSError, IOError):
                    pass

        # In place means build_lib is src.  We also log this.
        if self.inplace:
            log.debug('in-place js building enabled')
            self.build_lib = 'src'
        # Otherwise we fetch build_lib from the build command.
        else:
            self.set_undefined_options('build',
                                       ('build_lib', 'build_lib'))
            log.debug('regular js build: build path is %s' %
                     self.build_lib)

        if self.work_path is None:
            self.work_path = self.get_root_path()

    def _needs_built(self):
        for path in self.get_dist_paths():
            if not os.path.isdir(path):
                return True
        return False

    def _setup_git(self):
        work_path = self.work_path

        if os.path.exists(os.path.join(work_path, '.git')):
            log.info('initializing git submodules')
            self._run_command(['git', 'submodule', 'init'])
            self._run_command(['git', 'submodule', 'update'])

    def _setup_npm(self):
        node_version = []
        for app in 'node', 'npm':
            try:
                node_version.append(
                    self._run_command([app, '--version']).rstrip()
                )
            except OSError:
                log.fatal('Cannot find `{0}` executable. Please install {0}`'
                          ' and try again.'.format(app))
                sys.exit(1)

        log.info('using node ({}) and npm ({})'.format(*node_version))

        self._run_command(['npm', 'install', '--production', '--quiet'])

    def _run_command(self, cmd, env=None):
        log.debug('running [%s]' % (' '.join(cmd),))
        try:
            return check_output(cmd, cwd=self.work_path, env=env)
        except Exception:
            log.error('command failed [%s] via [%s]' % (
                ' '.join(cmd),
                self.work_path,
            ))
            raise

    def update_manifests(self):
        # if we were invoked from sdist, we need to inform sdist about
        # which files we just generated.  Otherwise they will be missing
        # in the manifest.  This adds the files for what webpack generates
        # plus our own assets.json file.
        sdist = self.distribution.get_command_obj('sdist')
        if not sdist.finalized:
            return

        # The path down from here only works for sdist:

        # Use the underlying file list so that we skip the file-exists
        # check which we do not want here.
        files = sdist.filelist.files
        base = os.path.abspath('.')

        # We need to split off the local parts of the files relative to
        # the current folder.  This will chop off the right path for the
        # manifest.
        for path in self.get_dist_paths():
            for dirname, _, filenames in os.walk(os.path.abspath(path)):
                for filename in filenames:
                    filename = os.path.join(dirname, filename)
                    files.append(filename[len(base):].lstrip(os.path.sep))

        for file in self.get_manifest_additions():
            files.append(file)

    def run(self):
        if self.force or self._needs_built():
            self._setup_git()
            self._setup_npm()
            self._build()
            self.update_manifests()
