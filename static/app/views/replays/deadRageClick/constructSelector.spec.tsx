import constructSelector from 'sentry/views/replays/deadRageClick/constructSelector';

describe('constructSelector', () => {
  it.each([
    {
      element: {
        alt: 'view more',
        aria_label: 'View More',
        class: ['classA'],
        id: 'ID1',
        role: 'button',
        tag: 'button',
        testid: 'button-test',
        title: 'cool title',
      },
      fullSelector:
        'button#ID1.classA[role="button"][aria="View More"][data-test-id="button-test"][alt="view more"][title="cool title"]',
      selector:
        'button#ID1.classA[role="button"][aria="View More"][data-test-id="button-test"][alt="view more"][title="cool title"]',
    },
    {
      element: {
        alt: '',
        aria_label: '',
        class: ['', ''],
        id: '',
        role: '',
        tag: 'a',
        testid: '',
        title: '',
      },
      fullSelector: 'a[role=""][aria=""][data-test-id=""][alt=""][title=""]',
      selector: 'a',
    },
    {
      element: {
        alt: '',
        aria_label: '',
        class: ['classA', ''],
        id: '',
        role: '',
        tag: 'a',
        testid: '',
        title: '',
      },
      fullSelector: 'a.classA[role=""][aria=""][data-test-id=""][alt=""][title=""]',
      selector: 'a.classA',
    },
    {
      element: {
        alt: '',
        aria_label: '',
        class: ['classA', ''],
        id: 'ID2',
        role: '',
        tag: 'a',
        testid: '',
        title: '',
      },
      fullSelector: 'a#ID2.classA[role=""][aria=""][data-test-id=""][alt=""][title=""]',
      selector: 'a#ID2.classA',
    },
    {
      element: {
        alt: '',
        aria_label: '',
        class: ['classA', 'classB'],
        id: 'ID2',
        role: '',
        tag: 'a',
        testid: '',
        title: '',
      },
      fullSelector:
        'a#ID2.classA.classB[role=""][aria=""][data-test-id=""][alt=""][title=""]',
      selector: 'a#ID2.classA.classB',
    },
    {
      element: {
        alt: '',
        aria_label: 'hello',
        class: ['classA', 'classB'],
        id: 'ID2',
        role: '',
        tag: 'a',
        testid: '',
        title: '',
      },
      fullSelector:
        'a#ID2.classA.classB[role=""][aria="hello"][data-test-id=""][alt=""][title=""]',
      selector: 'a#ID2.classA.classB[aria="hello"]',
    },
    {
      element: {
        alt: '',
        aria_label: 'hello',
        class: [''],
        id: 'ID2',
        role: '',
        tag: 'a',
        testid: '',
        title: '',
      },
      fullSelector: 'a#ID2[role=""][aria="hello"][data-test-id=""][alt=""][title=""]',
      selector: 'a#ID2[aria="hello"]',
    },
  ])(
    'should construct the correct trimmed selector and full selector, for each element in the list',
    ({element, fullSelector, selector}) => {
      expect(constructSelector(element)).toStrictEqual({fullSelector, selector});
    }
  );
});
