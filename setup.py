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
    'cssutils>=0.9.9',
    'BeautifulSoup>=3.2.1',
    'django-celery>=2.5.5',
    'celery>=2.5.3',
    'django-crispy-forms>=1.1.4',
    'Django>=1.4.5,<=1.5',
    'django-indexer>=0.3.0',
    'django-paging>=0.2.4',
    'django-picklefield>=0.2.0',
    'django-static-compiler>=0.3.0,<0.4.0',
    'django-templatetag-sugar>=0.1.0',
    'gunicorn>=0.14.6',
    'logan>=0.5.4',
    'Pygments>=1.5',
    'pynliner>=0.4.0',
    'python-dateutil>=1.5.0,<2.0.0',
    'raven>=3.1.15',
    'simplejson>=2.1.6',
    'South>=0.7.6',
    'httpagentparser>=1.0.5',
    'django-social-auth>=0.7.1,<1.0',
    'django-social-auth-trello>=1.0.2',
    'setproctitle>=1.1.7',
]

setup(
    name='sentry',
    version='5.4.1',
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
