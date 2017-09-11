#!/usr/bin/env python
"""
Sentry
======

Sentry is a realtime event logging and aggregation platform. It specializes
in monitoring errors and extracting all the information needed to do a proper
post-mortem without any of the hassle of the standard user feedback loop.

Sentry is a Server
------------------

The Sentry package, at its core, is just a simple server and web UI. It will
handle authentication clients (such as `Raven
<https://github.com/getsentry/raven-python>`_)
and all of the logic behind storage and aggregation.

That said, Sentry is not limited to Python. The primary implementation is in
Python, but it contains a full API for sending events from any language, in
any application.

:copyright: (c) 2011-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

# if sys.version_info[:2] != (2, 7):
#     print 'Error: Sentry requires Python 2.7'
#     sys.exit(1)

import os
import os.path
import sys

from distutils.command.build import build as BuildCommand
from setuptools import setup, find_packages
from setuptools.command.sdist import sdist as SDistCommand
from setuptools.command.develop import develop as DevelopCommand

ROOT = os.path.realpath(os.path.join(os.path.dirname(
    sys.modules['__main__'].__file__)))

# Add Sentry to path so we can import distutils
sys.path.insert(0, os.path.join(ROOT, 'src'))

from sentry.utils.distutils import (
    BuildAssetsCommand, BuildIntegrationDocsCommand
)

# The version of sentry
VERSION = '8.21.0.dev0'

# Hack to prevent stupid "TypeError: 'NoneType' object is not callable" error
# in multiprocessing/util.py _exit_function when running `python
# setup.py test` (see
# http://www.eby-sarna.com/pipermail/peak/2010-May/003357.html)
for m in ('multiprocessing', 'billiard'):
    try:
        __import__(m)
    except ImportError:
        pass

IS_LIGHT_BUILD = os.environ.get('SENTRY_LIGHT_BUILD') == '1'


# we use pip requirements files to improve Docker layer caching
def get_requirements(env):
    with open('requirements-{}.txt'.format(env)) as fp:
        return [x.strip() for x in fp.read().split('\n') if not x.startswith('#')]


install_requires = get_requirements('base')
dev_requires = get_requirements('dev')
saml_requires = get_requirements('saml')
tests_require = get_requirements('test')


class SentrySDistCommand(SDistCommand):
    # If we are not a light build we want to also execute build_assets as
    # part of our source build pipeline.
    if not IS_LIGHT_BUILD:
        sub_commands = SDistCommand.sub_commands + \
            [('build_integration_docs', None), ('build_assets', None)]


class SentryBuildCommand(BuildCommand):
    def run(self):
        BuildCommand.run(self)
        if not IS_LIGHT_BUILD:
            self.run_command('build_integration_docs')
            self.run_command('build_assets')


class SentryDevelopCommand(DevelopCommand):
    def run(self):
        DevelopCommand.run(self)
        if not IS_LIGHT_BUILD:
            self.run_command('build_integration_docs')
            self.run_command('build_assets')


cmdclass = {
    'sdist': SentrySDistCommand,
    'develop': SentryDevelopCommand,
    'build': SentryBuildCommand,
    'build_assets': BuildAssetsCommand,
    'build_integration_docs': BuildIntegrationDocsCommand,
}


setup(
    name='sentry',
    version=VERSION,
    author='Sentry',
    author_email='hello@sentry.io',
    url='https://sentry.io',
    description='A realtime logging and aggregation server.',
    long_description=open(os.path.join(ROOT, 'README.rst')).read(),
    package_dir={'': 'src'},
    packages=find_packages('src'),
    zip_safe=False,
    install_requires=install_requires,
    extras_require={
        'dev': dev_requires,
        'postgres': [],
        'saml': saml_requires,
        'tests': tests_require,
    },
    cmdclass=cmdclass,
    license='BSD',
    include_package_data=True,
    entry_points={
        'console_scripts': [
            'sentry = sentry.runner:main',
        ],
        'flake8.extension': [
        ],
    },
    classifiers=[
        'Framework :: Django',
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Operating System :: POSIX :: Linux',
        'Programming Language :: Python :: 2',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 2 :: Only',
        'Topic :: Software Development'
    ],
)
