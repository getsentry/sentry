import {getAriaLabel} from 'sentry/views/replays/detail/utils';

describe('getAriaLabel', () => {
  it.each([
    {
      element:
        'button#ID1.classA[role="button"][aria="View More"][data-test-id="button-test"][alt="view more"][title="cool title"]',
      ariaLabel: 'View More',
    },
    {
      element:
        'button#ID1.classA[role="button"][data-test-id="button-test"][alt="view more"][title="cool title"]',
      ariaLabel: '',
    },
  ])(
    'should construct the correct aria label for each element in the list',
    ({element, ariaLabel}) => {
      expect(getAriaLabel(element)).toStrictEqual(ariaLabel);
    }
  );
});
