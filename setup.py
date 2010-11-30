#!/usr/bin/env python

from setuptools import setup, find_packages

setup(
    name='django-sentry',
    version='1.4.0',
    author='David Cramer',
    author_email='dcramer@gmail.com',
    url='http://github.com/dcramer/django-sentry',
    description = 'Exception Logging to a Database in Django',
    packages=find_packages(),
    zip_safe=False,
    install_requires=[
        'django-paging>=0.2.2',
        'django-indexer==0.2',
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