import React from 'react';

import {render} from 'sentry-test/reactTestingLibrary';

import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';

describe('SQLishFormatter', function () {
  describe('SQLishFormatter.toString()', () => {
    const formatter = new SQLishFormatter();

    it('Falls back to original string if unable to parse', () => {
      expect(formatter.toString('😤')).toEqual('😤');
    });

    it('Adds newlines for keywords', () => {
      expect(
        formatter.toString('SELECT hello FROM users ORDER BY name DESC LIMIT 1;')
      ).toEqual('SELECT hello \nFROM users \nORDER BY name DESC \nLIMIT 1;');
    });
  });

  describe('SQLishFormatter.toSimpleMarkup()', () => {
    const formatter = new SQLishFormatter();
    const getMarkup = (markup: any): string => {
      const {container} = render(<React.Fragment>{markup}</React.Fragment>);

      return container.innerHTML;
    };

    beforeEach(() => {
      // The renderer throws an error because elements in the list do not have
      // a `"key"` prop, but that's intentional. The list elements are spans
      // with no semantic meaning, and their keys are not meaningful.
      jest.spyOn(console, 'error').mockImplementation(jest.fn());
    });

    it('Capitalizes keywords', () => {
      expect(getMarkup(formatter.toSimpleMarkup('select hello'))).toEqual(
        '<b>SELECT</b><span> </span><span>hello</span>'
      );
    });

    it('Wraps every token in a `<span>` element', () => {
      expect(getMarkup(formatter.toSimpleMarkup('SELECT hello;'))).toEqual(
        '<b>SELECT</b><span> </span><span>hello;</span>'
      );
    });
  });
});
