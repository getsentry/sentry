#!/usr/bin/env python

import sys

try:
    from setuptools import setup, find_packages, Command
except ImportError:
    from ez_setup import use_setuptools
    use_setuptools()
    from setuptools import setup, find_packages, Command

tests_require = [
    'nose==1.1.2',
    'django-nose==0.1.3',

    # celery
    'django-celery',
]

install_requires = [
    'Django>=1.2,<1.4',
    'django-bitfield',
    'django-paging>=0.2.4',
    'django-indexer>=0.3.0',
    'django-templatetag-sugar>=0.1.0',
    'raven>=2.0.0',
    'python-daemon>=1.6',
    'eventlet>=0.9.15',
    'South>=0.7',
]

if sys.version_info[:2] < (2, 5):
    install_requires.append('uuid')

setup(
    name='django-sentry',
    version='2.0.0',
    author='David Cramer',
    author_email='dcramer@gmail.com',
    url='http://github.com/dcramer/django-sentry',
    description = 'Exception Logging to a Database in Django',
    packages=find_packages(exclude=("example_project", "tests")),
    zip_safe=False,
    install_requires=install_requires,
    tests_require=tests_require,
    extras_require={'test': tests_require},
    test_suite='runtests.runtests',
    include_package_data=True,
    entry_points = {
        'console_scripts': [
            'sentry = sentry.scripts.runner:main',
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
