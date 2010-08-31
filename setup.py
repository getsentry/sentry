#!/usr/bin/env python

from setuptools import setup, find_packages

setup(
    name='django-sentry',
    version='.'.join(map(str, __import__('sentry').__version__)),
    author='David Cramer',
    author_email='dcramer@gmail.com',
    url='http://github.com/dcramer/django-sentry',
    description = 'Exception Logging to a Database in Django',
    packages=find_packages(),
    requirements=[
        'django-paging',
    ],
    include_package_data=True,
    classifiers=[
        'Framework :: Django',
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Operating System :: OS Independent',
        'Topic :: Software Development'
    ],
)