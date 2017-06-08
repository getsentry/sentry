from __future__ import absolute_import

import itertools
import operator
from collections import namedtuple

from sentry.utils.iterators import lookahead

Class = namedtuple('Class', [
    'old',
    'new',
])

Field = namedtuple('Field', [
    'type',
    'old',
    'new',
])

Method = namedtuple('Method', [
    'first_line',
    'last_line',
    'type',
    'old',
    'arguments',
    'new'
])


class InvalidInput(Exception):
    pass


def parse_class_mapping(line):
    """Process an input line, returning a Class struct."""
    arrow_index = line.find('->')
    if arrow_index == -1:
        raise InvalidInput('Input does not contain an arrow separator.')

    colon_index = line.find(':', arrow_index + 2)
    if colon_index == -1:
        raise InvalidInput('Input does not contain a colon separator.')

    return Class(*map(
        operator.methodcaller('strip'),
        line[:colon_index].split('->'),
    ))


def parse_class_member_mapping(line):
    """Process an input line, returning either a Method or Field struct."""
    colon_index_1 = line.find(':')
    colon_index_2 = line.find(':', colon_index_1 + 1) if colon_index_1 else -1

    # NOTE: This seems a little strange, but it's a direct port of the retrace logic.
    space_index = line.find(' ', colon_index_2 + 2)

    argument_index_1 = line.find('(', space_index + 1)
    argument_index_2 = line.find(')', argument_index_1 + 1) if argument_index_1 else -1

    arrow_index = line.find('->', max(space_index, argument_index_2 + 1))

    if not space_index:
        raise InvalidInput('Input does not contain a space separator.')

    if not arrow_index:
        raise InvalidInput('Input does not contain an arrow separator.')

    type = line[(colon_index_2 + 1):space_index].strip()
    name = line[(space_index + 1):(argument_index_1 if argument_index_1 >= 0 else arrow_index)].strip()
    new_name = line[arrow_index + 2:].strip()

    if not type:
        raise InvalidInput('Input does not contain a type field.')

    if not name:
        raise InvalidInput('Input does not contain a name field.')

    if not new_name:
        raise InvalidInput('Value does not contain a mapped name field.')

    if argument_index_2 < 0:
        result = Field(type, name, new_name)
    else:
        first_line_number = None
        last_line_number = None
        if colon_index_2 > 0:
            first_line_number = int(line[:colon_index_1].strip())
            last_line_number = int(line[(colon_index_1 + 1):colon_index_2].strip())
        arguments = line[(argument_index_1 + 1):argument_index_2].strip()
        result = Method(first_line_number, last_line_number, type, name, arguments, new_name)

    return result


line_parsers = [
    parse_class_mapping,
    parse_class_member_mapping,
]


def parse_line(line):
    line = line.strip()
    errors = {}
    for line_parser in line_parsers:
        try:
            return line_parser(line)
        except InvalidInput as e:
            errors[line_parser] = e
    raise InvalidInput('Could not process input, all line parsers raised errors: %r' % (errors,))


def parse_file(file):
    """\
    Parse a ProGuard mapping file.

    This returns a generator that yields two tuples of (Class, Iterator[Union[Field,Method]]).
    """
    lines = lookahead(itertools.imap(parse_line, file))

    def read_class_members():
        """Consumes items from a stream until the end of a class block."""
        for current, upcoming in lines:
            yield current
            if isinstance(upcoming, Class):
                return

    while True:
        try:
            current, upcoming = next(lines)
        except StopIteration:
            return

        assert isinstance(current, Class), 'Expected class definition.'
        yield current, read_class_members()


if __name__ == '__main__':
    import sys

    output = sys.stdout
    for cls, members in parse_file(sys.stdin):
        output.write(repr(cls))
        output.write('\n')
        for member in members:
            output.write('  ')
            output.write(repr(member))
            output.write('\n')

    output.close()
