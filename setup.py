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
handle authentication clients (such as `Raven <https://github.com/getsentry/raven-python>`_)
and all of the logic behind storage and aggregation.

That said, Sentry is not limited to Python. The primary implementation is in
Python, but it contains a full API for sending events from any language, in
any application.

:copyright: (c) 2011-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from distutils import log
from setuptools.command.sdist import sdist
from setuptools.command.develop import develop
from setuptools import setup, find_packages
from subprocess import check_output


# Hack to prevent stupid "TypeError: 'NoneType' object is not callable" error
# in multiprocessing/util.py _exit_function when running `python
# setup.py test` (see
# http://www.eby-sarna.com/pipermail/peak/2010-May/003357.html)
for m in ('multiprocessing', 'billiard'):
    try:
        __import__(m)
    except ImportError:
        pass

dev_requires = [
    'flake8>=2.0,<2.1',
]

tests_require = [
    'casscache',
    'cqlsh',
    'elasticsearch',
    'exam>=0.5.1',
    'eventlet',
    'httpretty',
    'pytest',
    'pytest-cov>=1.4',
    'pytest-django',
    'pytest-timeout',
    'python-coveralls',
    'mock>=0.8.0',
    'riak',
    'unittest2',
]


install_requires = [
    'BeautifulSoup>=3.2.1,<3.3.0',
    'celery>=3.0.15,<3.1.0',
    'cssutils>=0.9.9,<0.10.0',
    'Django>=1.5.8,<1.6',
    'django-bitfield>=1.7.0,<1.8.0',
    'django-celery>=3.0.11,<3.1.0',
    'django-crispy-forms>=1.4.0,<1.5.0',
    'django-paging>=0.2.5,<0.3.0',
    'django-picklefield>=0.3.0,<0.4.0',
    'django-recaptcha>=1.0.0,<1.1.0',
    'django-social-auth>=0.7.28,<0.8.0',
    'django-static-compiler>=0.3.0,<0.4.0',
    'django-statsd-mozilla>=0.3.8.0,<0.3.9.0',
    'django-sudo>=1.1.0,<1.2.0',
    'django-templatetag-sugar>=0.1.0',
    'djangorestframework>=2.3.8,<2.4.0',
    'email-reply-parser>=0.2.0,<0.3.0',
    'enum34>=0.9.18,<0.10.0',
    'gunicorn>=0.17.2,<0.18.0',
    'ipaddr>=2.1.11,<2.2.0',
    'logan>=0.5.8.2,<0.6.0',
    'nydus>=0.10.7,<0.11.0',
    'markdown>=2.4.1,<2.5.0',
    'Pygments>=1.6.0,<1.7.0',
    'python-dateutil>=1.5.0,<2.0.0',
    'python-memcached>=1.53,<2.0.0',
    'raven>=5.0.0',
    'redis>=2.7.0,<2.9.0',
    'simplejson>=3.1.0,<3.4.0',
    'six>=1.6.0,<1.7.0',
    'setproctitle>=1.1.7,<1.2.0',
    'South==0.8.2',
    'toronado>=0.0.4,<0.1.0',
    'ua-parser>=0.3.5',
    'urllib3>=1.7.1,<1.8.0',
]

postgres_requires = [
    'psycopg2>=2.5.0,<2.6.0',
]

postgres_pypy_requires = [
    'psycopg2cffi',
]

mysql_requires = [
    'MySQL-python>=1.2.0,<1.3.0',
]


class CustomSdist(sdist):
    def make_distribution(self):
        log.info("running npm install")
        check_output(['npm', 'install', '--quiet'])
        log.info("running sentry compilestatic")
        check_output(['sentry', 'compilestatic'])
        return sdist.make_distribution(self)


class CustomDevelop(develop):
    def install_for_development(self):
        log.info("running npm install")
        check_output(['npm', 'install', '--quiet'])
        # TODO(dcramer): can we run compilestatic somehow here?
        return develop.install_for_development(self)


setup(
    name='sentry',
    version='7.0.0-DEV',
    author='David Cramer',
    author_email='dcramer@gmail.com',
    url='https://www.getsentry.com',
    description='A realtime logging and aggregation server.',
    long_description=open('README.rst').read(),
    package_dir={'': 'src'},
    packages=find_packages('src'),
    zip_safe=False,
    install_requires=install_requires,
    extras_require={
        'tests': tests_require,
        'dev': dev_requires,
        'postgres': install_requires + postgres_requires,
        'postgres_pypy': install_requires + postgres_pypy_requires,
        'mysql': install_requires + mysql_requires,
    },
    cmdclass={
        'sdist': CustomSdist,
        'develop': CustomDevelop,
    },
    license='BSD',
    include_package_data=True,
    entry_points={
        'console_scripts': [
            'sentry = sentry.utils.runner:main',
        ],
    },
    classifiers=[
        'Framework :: Django',
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Operating System :: OS Independent',
        'Topic :: Software Development'
    ],
)
