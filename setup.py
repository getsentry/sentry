#!/usr/bin/env python

try:
    from setuptools import setup, find_packages, Command
except ImportError:
    from ez_setup import use_setuptools
    use_setuptools()
    from setuptools import setup, find_packages, Command

tests_require = [
    'Django>=1.2,<1.4',
    
    # celery
    'django-celery',
    
    # django migrations
    'south',
    
    # haystack support
    'django-haystack',
    'whoosh',
    
    # python-daemon and eventlet are required to run the Sentry independent webserver
    'python-daemon>=1.6',
    'eventlet>=0.9.15',
]

install_requires = [
    'django-paging>=0.2.4',
    'django-indexer>=0.3.0',
    'django-templatetag-sugar>=0.1.0',
]

try:
    __import__('uuid')
except ImportError:
    # Older versions of Python did not include uuid
    install_requires.append('uuid')

setup(
    name='django-sentry',
    version='1.8.6.2',
    author='David Cramer',
    author_email='dcramer@gmail.com',
    url='http://github.com/dcramer/django-sentry',
    description = 'Exception Logging to a Database in Django',
    packages=find_packages(exclude=("example_project", "tests")),
    zip_safe=False,
    install_requires=install_requires,
    dependency_links=[
        'https://github.com/disqus/django-haystack/tarball/master#egg=django-haystack',
    ],
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
