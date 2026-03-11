import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import FormSource, {setSearchMap} from 'sentry/components/search/sources/formSource';

describe('FormSource', () => {
  const searchMap = [
    {
      title: 'Test Field',
      description: 'test-help',
      route: '/route/',
      field: {
        name: 'test-field',
        label: 'Test Field',
        help: 'test-help',
        type: 'text',
      },
    },
    {
      title: 'Foo Field',
      description: 'foo-help',
      route: '/foo/',
      field: {
        name: 'foo-field',
        label: 'Foo Field',
        help: 'foo-help',
        type: 'text',
      },
    },
  ];

  beforeEach(() => {
    setSearchMap(searchMap);
  });

  it('can find a form field', async () => {
    const mock = jest.fn().mockReturnValue(null);
    render(<FormSource query="te">{mock}</FormSource>);

    await waitFor(() =>
      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          results: [
            expect.objectContaining({
              item: {
                field: {
                  label: 'Test Field',
                  name: 'test-field',
                  help: 'test-help',
                  type: 'text',
                },
                title: 'Test Field',
                description: 'test-help',
                route: '/route/',
                resultType: 'field',
                sourceType: 'field',
                to: {pathname: '/route/', hash: '#test-field'},
                resolvedTs: expect.anything(),
              },
            }),
          ],
        })
      )
    );
  });

  it('does not find any form field', async () => {
    const mock = jest.fn().mockReturnValue(null);
    render(<FormSource query="invalid">{mock}</FormSource>);

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith({
        isLoading: false,
        results: [],
      })
    );
  });
});
