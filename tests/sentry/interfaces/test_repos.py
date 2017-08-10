# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry.interfaces.base import InterfaceValidationError
from sentry.interfaces.repos import Repos
from sentry.testutils import TestCase


class ReposTest(TestCase):
    def test_minimal_valid(self):
        assert Repos.to_python({
            '/path/to/sentry': {
                'name': 'sentry-unity',
            },
        }).to_json() == {
            '/path/to/sentry': {
                'name': 'sentry-unity',
            },
        }

    def test_full_valid(self):
        assert Repos.to_python(
            {
                '/path/to/sentry': {
                    'name': 'sentry-unity',
                    'prefix': 'src',
                    'revision': 'a' * 40,
                },
            }
        ).to_json() == {
            '/path/to/sentry': {
                'name': 'sentry-unity',
                'prefix': 'src',
                'revision': 'a' * 40,
            },
        }

    def test_missing_name(self):
        with pytest.raises(InterfaceValidationError):
            assert Repos.to_python({
                '/path/to/sentry': {},
            })

    def test_long_name(self):
        with pytest.raises(InterfaceValidationError):
            assert Repos.to_python({
                '/path/to/sentry': {
                    'name': 'a' * 300,
                },
            })

    def test_long_prefix(self):
        with pytest.raises(InterfaceValidationError):
            assert Repos.to_python({
                '/path/to/sentry': {
                    'name': 'a',
                    'prefix': 'a' * 300,
                },
            })

    def test_long_revision(self):
        with pytest.raises(InterfaceValidationError):
            assert Repos.to_python({
                '/path/to/sentry': {
                    'name': 'a',
                    'revision': 'a' * 300,
                },
            })

    def test_long_path(self):
        with pytest.raises(InterfaceValidationError):
            assert Repos.to_python({
                '/' * 300: {
                    'name': 'a',
                },
            })

    def test_path(self):
        assert Repos().get_path() == 'repos'
