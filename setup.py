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

:copyright: (c) 2011-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from setuptools import setup, find_packages

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
    'flake8>=1.7.0',
    'pytest-cov>=1.4',
]

tests_require = [
    'exam>=0.5.1',
    'eventlet',
    'pytest',
    'pytest-django',
    'nydus',
    'mock>=0.8.0',
    'mock-django>=0.6.4',
    'redis',
    'unittest2',
]


install_requires = [
    'cssutils>=0.9.9,<0.10.0',
    'BeautifulSoup>=3.2.1,<3.3.0',
    'django-celery>=3.0.11,<3.1.0',
    'celery>=3.0.15,<3.1.0',
    'django-crispy-forms>=1.2.3,<1.3.0',
    'Django>=1.4.5,<1.5',
    'django-indexer>=0.3.0,<0.4.0',
    'django-paging>=0.2.4,<0.3.0',
    'django-picklefield>=0.3.0,<0.4.0',
    'django-static-compiler>=0.3.0,<0.4.0',
    'django-templatetag-sugar>=0.1.0,<0.2.0',
    'gunicorn>=0.17.2,<0.18.0',
    'logan>=0.5.4,<0.6.0',
    'nydus>=0.10.0,<0.11.0',
    'Pygments>=1.6.0,<1.7.0',
    'pynliner>=0.4.0,<0.5.0',
    'python-dateutil>=1.5.0,<2.0.0',
    'raven>=3.1.17',
    'redis>2.7.0,<2.8.0',
    'simplejson>=3.1.0,<3.2.0',
    'South==0.8.2',
    'httpagentparser>=1.2.1,<1.3.0',
    'django-social-auth>=0.7.1,<0.8.0',
    'django-social-auth-trello>=1.0.3,<1.1.0',
    'setproctitle>=1.1.7,<1.2.0',
]

postgres_requires = [
    'psycopg2>=2.4.0,<2.5.0',
]

mysql_requires = [
    'MySQL-python>=1.2.0,<1.3.0',
]


setup(
    name='sentry',
    version='5.4.7',
    author='David Cramer',
    author_email='dcramer@gmail.com',
    url='http://www.getsentry.com',
    description='A realtime logging and aggregation server.',
    long_description=__doc__,
    package_dir={'': 'src'},
    packages=find_packages('src'),
    zip_safe=False,
    install_requires=install_requires,
    extras_require={
        'tests': tests_require,
        'dev': dev_requires,
        'postgres': install_requires + postgres_requires,
        'mysql': install_requires + mysql_requires,
    },
    test_suite='runtests.runtests',
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
