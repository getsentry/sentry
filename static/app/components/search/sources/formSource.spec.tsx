import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import * as ActionCreators from 'sentry/actionCreators/formSearch';
import FormSource from 'sentry/components/search/sources/formSource';
import FormSearchStore, {FormSearchField} from 'sentry/stores/formSearchStore';

describe('FormSource', function () {
  const searchMap: FormSearchField[] = [
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

  beforeEach(function () {
    jest.spyOn(ActionCreators, 'loadSearchMap').mockImplementation(() => {});

    FormSearchStore.loadSearchMap(searchMap);
  });

  afterEach(function () {
    (ActionCreators.loadSearchMap as jest.Mock).mockRestore();
  });

  it('can find a form field', async function () {
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
                to: '/route/#test-field',
              },
            }),
          ],
        })
      )
    );
  });

  it('does not find any form field', async function () {
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
