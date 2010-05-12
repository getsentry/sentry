#!/usr/bin/env python

from setuptools import setup, find_packages

import djangodblog

setup(
    name='django-db-log',
    version='.'.join(map(str, djangodblog.__version__)),
    author='David Cramer',
    author_email='dcramer@gmail.com',
    url='http://github.com/dcramer/django-db-log',
    install_requires=[
        # 'Django>=1.0'
    ],
    description = 'Exception Logging to a Database in Django',
    packages=find_packages(),
    include_package_data=True,
    classifiers=[
        'Framework :: Django',
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Operating System :: OS Independent',
        'Topic :: Software Development'
    ],
)