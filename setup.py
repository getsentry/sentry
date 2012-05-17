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
handle authentication clients (such as `Raven <https://github.com/dcramer/raven>`_)
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
try:
    import multiprocessing
except ImportError:
    pass

tests_require = [
    'django-nose==0.1.3',
    'eventlet==0.9.16',
    'nose==1.1.2',
    'nydus==0.8.2',
    'mock==0.8.0',
    'pep8',
    'redis',
]


install_requires = [
    'cssutils>=0.9.9',
    'BeautifulSoup>=3.2.1',
    'django-celery>=2.5.5,<3.0',
    'Django>=1.2,<1.4',
    'django-indexer>=0.3.0',
    'django-paging>=0.2.4',
    'django-picklefield>=0.2.0',
    'django-templatetag-sugar>=0.1.0',
    'gunicorn>=0.13.4,<0.14.0',
    'logan>=0.3.0',
    'pynliner>=0.4.0',
    'python-dateutil>=1.5.0,<2.0.0',
    'pytz>=2011n',
    'raven>=1.7.7',
    'simplejson>=2.3.0,<2.5.0',
    'South>=0.7',
]

setup(
    name='sentry',
    version='4.3.3',
    author='David Cramer',
    author_email='dcramer@gmail.com',
    url='http://github.com/dcramer/sentry',
    description='A realtime logging and aggregation server.',
    long_description=__doc__,
    packages=find_packages(exclude=['tests']),
    zip_safe=False,
    install_requires=install_requires,
    tests_require=tests_require,
    extras_require={'test': tests_require},
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
