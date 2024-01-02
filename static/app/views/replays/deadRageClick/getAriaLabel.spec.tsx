import getAriaLabel from './getAriaLabel';

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
    {
      element:
        'button#ID1.classA[role="button"][aria="[Filtered]"][data-test-id="button-test"][alt="view more"][title="cool title"]',
      ariaLabel: '[Filtered]',
    },
    {
      element:
        'button#ID1.classA[role="button"][aria="[]"][data-test-id="button-test"][alt="view more"][title="cool title"]',
      ariaLabel: '[]',
    },
    {
      element:
        'button#ID1.classA[role="button"][aria=""][data-test-id="button-test"][alt="view more"][title="cool title"]',
      ariaLabel: '',
    },
    {
      element:
        'button#ID1.classA[role="button"][aria="["][data-test-id="button-test"][alt="view more"][title="cool title"]',
      ariaLabel: '[',
    },
    {
      element:
        'button#ID1.classA[role="button"][aria="]blah"][data-test-id="button-test"][alt="view more"][title="cool title"]',
      ariaLabel: ']blah',
    },
    {
      element:
        'button#ID1.classA[role="button"][aria="""][data-test-id="button-test"][alt="view more"][title="cool title"]',
      ariaLabel: '"',
    },
    {
      element:
        'button#ID1.classA[role="button"][aria="]""][data-test-id="button-test"][alt="view more"][title="cool title"]',
      ariaLabel: ']"',
    },
  ])(
    'should construct the correct aria label for each element in the list',
    ({element, ariaLabel}) => {
      expect(getAriaLabel(element)).toStrictEqual(ariaLabel);
    }
  );
});
