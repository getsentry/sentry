from __future__ import absolute_import

from copy import deepcopy

from sentry.utils.meta import Meta, get_valid, get_all_valid
from sentry.testutils import TestCase


input_meta = {'': {
    'err': ['existing'],
    'val': 'original',
    'rem': [{'type': 'x'}],
}}

other_meta = {'': {
    'err': ['additional'],
    'val': 'changed',
    'rem': [{'type': 'y'}],
}}

merged_meta = {'': {
    'err': ['existing', 'additional'],
    'val': 'changed',
    'rem': [{'type': 'y'}],
}}


class MetaTests(TestCase):
    def test_get_new(self):
        assert Meta().raw() == {}
        assert Meta().get() == {}
        assert Meta().get_errors() == []

    def test_create_new(self):
        meta = Meta()
        assert meta.create() == {}
        assert meta.raw() == {'': {}}

    def test_merge_new(self):
        meta = Meta()
        assert meta.merge(Meta(other_meta)) == other_meta['']
        assert meta.raw() == other_meta

    def test_add_error_new(self):
        meta = Meta()
        meta.add_error('additional', 'changed')
        assert meta.raw() == {'': {
            'err': ['additional'],
            'val': 'changed',
        }}

    def test_get_missing(self):
        assert Meta({}).raw() == {}
        assert Meta({}).get() == {}
        assert Meta({}).get_errors() == []

    def test_create_missing(self):
        data = {}
        meta = Meta(data)
        assert meta.create() == {}
        assert data == {'': {}}

    def test_merge_missing(self):
        data = {}
        meta = Meta(data)
        assert meta.merge(Meta(other_meta)) == other_meta['']
        assert data == other_meta

    def test_add_error_missing(self):
        data = {}
        meta = Meta(data)
        meta.add_error('additional', 'changed')
        assert data == {'': {
            'err': ['additional'],
            'val': 'changed',
        }}

    def test_get_none(self):
        assert Meta({'': None}).raw() == {'': None}
        assert Meta({'': None}).get() == {}
        assert Meta({'': None}).get_errors() == []

    def test_create_none(self):
        data = {'': None}
        meta = Meta(data)
        assert meta.create() == {}
        assert data == {'': {}}

    def test_merge_none(self):
        data = {'': None}
        meta = Meta(data)
        assert meta.merge(Meta(other_meta)) == other_meta['']
        assert data == other_meta

    def test_add_error_none(self):
        data = {'': None}
        meta = Meta(data)
        meta.add_error('additional', 'changed')
        assert data == {'': {
            'err': ['additional'],
            'val': 'changed',
        }}

    def test_get_empty(self):
        assert Meta({'': {}}).raw() == {'': {}}
        assert Meta({'': {}}).get() == {}
        assert Meta({'': {}}).get_errors() == []

    def test_create_empty(self):
        data = {'': {}}
        meta = Meta(data)
        assert meta.create() == {}
        assert data == {'': {}}

    def test_merge_empty(self):
        data = {'': {}}
        meta = Meta(data)
        assert meta.merge(Meta(other_meta)) == other_meta['']
        assert data == other_meta

    def test_add_error_empty(self):
        data = {'': {}}
        meta = Meta(data)
        meta.add_error('additional', 'changed')
        assert data == {'': {
            'err': ['additional'],
            'val': 'changed',
        }}

    def test_get_root(self):
        assert Meta(input_meta).raw() == input_meta
        assert Meta(input_meta).get() == input_meta['']
        assert Meta(input_meta).get_errors() == ['existing']

    def test_create_root(self):
        changed = deepcopy(input_meta)
        meta = Meta(changed)
        # should be idempotent
        assert meta.create() == input_meta['']
        assert changed == input_meta

    def test_merge_root(self):
        changed = deepcopy(input_meta)
        meta = Meta(changed)
        assert meta.merge(Meta(other_meta)) == merged_meta['']
        assert changed == merged_meta

    def test_add_error_root(self):
        changed = deepcopy(input_meta)
        meta = Meta(changed)
        meta.add_error('additional', 'changed')
        assert meta.get() == {
            'err': ['existing', 'additional'],
            'val': 'changed',
            'rem': [{'type': 'x'}],
        }

    def test_get_nested_missing(self):
        data = {}
        assert Meta(data).enter('field').raw() == {}
        assert Meta(data).enter('field').get() == {}
        assert Meta(data).enter('field').get_errors() == []

    def test_create_nested_missing(self):
        data = {}
        meta = Meta(data)
        assert meta.enter('field').create() == {}
        assert data == {'field': {'': {}}}

    def test_merge_nested_missing(self):
        data = {}
        meta = Meta(data)
        assert meta.enter('field').merge(Meta(other_meta)) == other_meta['']
        assert data == {'field': other_meta}

    def test_add_error_nested_missing(self):
        data = {}
        meta = Meta(data)
        meta.enter('field').add_error('additional', 'changed')
        assert meta.enter('field').get() == {
            'err': ['additional'],
            'val': 'changed',
        }

    def test_get_nested_existing(self):
        data = {'field': input_meta}
        assert Meta(data).enter('field').raw() == input_meta
        assert Meta(data).enter('field').get() == input_meta['']
        assert Meta(data).enter('field').get_errors() == ['existing']

    def test_create_nested_existing(self):
        data = {'field': input_meta}
        changed = deepcopy(data)
        meta = Meta(changed)
        assert meta.enter('field').create() == input_meta['']
        assert changed == data

    def test_merge_nested_existing(self):
        data = {'field': input_meta}
        changed = deepcopy(data)
        meta = Meta(changed)
        assert meta.enter('field').merge(Meta(other_meta)) == merged_meta['']
        assert changed == {'field': merged_meta}

    def test_add_error_nested_existing(self):
        data = {'field': input_meta}
        changed = deepcopy(data)
        meta = Meta(changed)
        meta.enter('field').add_error('additional', 'changed')
        assert meta.enter('field').get() == {
            'err': ['existing', 'additional'],
            'val': 'changed',
            'rem': [{'type': 'x'}],
        }

    def test_get_nested_index(self):
        data = {'0': input_meta}
        assert Meta(data).enter(0).raw() == input_meta
        assert Meta(data).enter(0).get() == input_meta['']
        assert Meta(data).enter(0).get_errors() == ['existing']

    def test_create_nested_index(self):
        data = {}
        meta = Meta(data)
        assert meta.enter(0).create() == {}
        assert data == {'0': {'': {}}}

    def test_stringify_error(self):
        meta = Meta()
        meta.add_error(ValueError('invalid stuff'), 'changed')
        assert meta.get_errors() == ['invalid stuff']


class GetValidTests(TestCase):
    def test_get_non_object(self):
        assert get_valid(None, 'foo') is None
        assert get_valid('foo', 'foo') is None
        assert get_valid(42, 'foo') is None
        assert get_valid(ValueError(), 'foo') is None
        assert get_valid(True, 'foo') is None

    def test_without_meta(self):
        data = {
            'top': 42,
            'arr': [42, 21],
            'field': {
                'nested': 42,
            },
        }

        assert get_valid(data) == data
        assert get_valid(data, 'top') == 42
        assert get_valid(data, 'arr', 0) == 42
        assert get_valid(data, 'arr', -1) == 21
        assert get_valid(data, 'field', 'nested') == 42
        assert get_valid(data, 'nope') is None
        assert get_valid(data, 'nope', 'nope') is None

    def test_valid_meta(self):
        data = {
            'top': 42,
            'arr': [42, 21],
            'field': {
                'nested': 42,
            },
            '_meta': {
                'top': {'': {'val': None}},
                'arr': {
                    '': {'val': None},
                    '0': {'': {'val': None}},
                    '1': {'': {'val': None}},
                },
                'field': {
                    '': {'val': None},
                    'nested': {'': {'val': None}},
                },
            }
        }

        assert get_valid(data) == data
        assert get_valid(data, 'top') == 42
        assert get_valid(data, 'arr', 0) == 42
        assert get_valid(data, 'arr', -1) == 21
        assert get_valid(data, 'field', 'nested') == 42
        assert get_valid(data, 'nope') is None
        assert get_valid(data, 'nope', 'nope') is None

    def test_invalid_meta(self):
        data = {
            'top': 42,
            'arr': [42, 21],
            'field': {
                'nested': 42,
            },
            '_meta': {
                'top': {'': {'err': ['invalid']}},
                'arr': {
                    '0': {'': {'err': ['invalid']}},
                    '1': {'': {'err': ['invalid']}},
                },
                'field': {
                    'nested': {'': {'err': ['invalid']}},
                },
            }
        }

        assert get_valid(data) == data
        assert get_valid(data, 'top') is None
        assert get_valid(data, 'arr', 0) is None
        assert get_valid(data, 'arr', -1) is None
        assert get_valid(data, 'field', 'nested') is None
        assert get_valid(data, 'nope') is None
        assert get_valid(data, 'nope', 'nope') is None

    def test_invalid_path(self):
        data = {
            'arr': [42, 21],
            'field': {
                'nested': 42,
            },
            '_meta': {
                'arr': {'': {'err': ['invalid']}},
                'field': {'': {'err': ['invalid']}},
            }
        }

        assert get_valid(data, 'arr', 0) is None
        assert get_valid(data, 'arr', -1) is None
        assert get_valid(data, 'field', 'nested') is None


class GetValidAllTests(TestCase):
    def test_non_list(self):
        assert get_all_valid({'key': None}, 'key') is None
        assert get_all_valid({'key': 'key'}, 'key') == 'key'
        assert get_all_valid({'key': 42}, 'key') == 42
        assert get_all_valid({'key': True}, 'key')
        assert get_all_valid({'key': {'foo': True}}, 'key') == {'foo': True}
        assert get_all_valid(None, 'key') is None
        assert get_all_valid({}, 'key') is None

    def test_without_meta(self):
        data = {
            'key': [1, 2, 3]
        }

        assert get_all_valid(data, 'key') == [1, 2, 3]

    def test_valid_meta(self):
        data = {
            'key': [1, 2, 3],
            '_meta': {
                'key': {
                    '': {'val': None},
                    '0': {'': {'val': None}},
                    '1': {'': {'val': None}},
                    '2': {'': {'val': None}},
                }
            }
        }

        assert get_all_valid(data, 'key') == [1, 2, 3]

    def test_invalid_meta(self):
        data = {
            'key': [1, 2, 3],
            '_meta': {
                'key': {
                    '1': {'': {'err': ['invalid']}},
                }
            }
        }

        assert get_all_valid(data, 'key') == [1, 3]

    def test_invalid_meta_tuple(self):
        data = {
            'key': (1, 2, 3),
            '_meta': {
                'key': {
                    '1': {'': {'err': ['invalid']}},
                }
            }
        }

        assert get_all_valid(data, 'key') == [1, 3]

    def test_invalid_path(self):
        data = {
            'key': [1, 2, 3],
            '_meta': {
                'key': {'': {'err': ['invalid']}}
            }
        }

        assert get_all_valid(data, 'key') is None
