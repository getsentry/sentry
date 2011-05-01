#!/usr/bin/env python

try:
    from setuptools import setup, find_packages
except ImportError:
    from ez_setup import use_setuptools
    use_setuptools()
    from setuptools import setup, find_packages

tests_require = [
    'Django',
    'django-celery',
    'south',
    'django-haystack',
    'whoosh',
]

setup(
    name='django-sentry',
    version='1.7.3',
    author='David Cramer',
    author_email='dcramer@gmail.com',
    url='http://github.com/dcramer/django-sentry',
    description = 'Exception Logging to a Database in Django',
    packages=find_packages(exclude="example_project"),
    zip_safe=False,
    install_requires=[
        'django-paging>=0.2.4',
        'django-indexer>=0.3.0',
        'django-templatetag-sugar>=0.1.0',
        'uuid',
    ],
    dependency_links=[
        'https://github.com/disqus/django-haystack/tarball/master#egg=django-haystack',
    ],
    tests_require=tests_require,
    extras_require={'test': tests_require},
    test_suite='sentry.runtests.runtests',
    include_package_data=True,
    classifiers=[
        'Framework :: Django',
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Operating System :: OS Independent',
        'Topic :: Software Development'
    ],
)
