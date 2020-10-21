import {mountWithTheme} from 'sentry-test/enzyme';

import {Form, SelectAsyncField} from 'app/components/forms';

describe('SelectAsyncField', function () {
  let api;

  beforeEach(function () {
    api = MockApiClient.addMockResponse({
      url: '/foo/bar/',
      query: {
        autocomplete_query: 'baz',
        autocomplete_field: 'fieldName',
      },
      body: {
        fieldName: [{id: 'baz', text: 'Baz Label'}],
      },
    });
  });

  describe('deprecatedSelectControl', function () {
    it('supports autocomplete arguments from an integration', async function () {
      const wrapper = mountWithTheme(
        <SelectAsyncField deprecatedSelectControl url="/foo/bar/" name="fieldName" />
      );

      wrapper
        .find('input[id="id-fieldName"]')
        .simulate('change', {target: {value: 'baz'}});

      expect(api).toHaveBeenCalled();

      await tick();
      wrapper.update();

      // Is in select menu
      expect(wrapper.find('Select').prop('options')).toEqual([
        expect.objectContaining({
          value: 'baz',
          label: 'Baz Label',
        }),
      ]);
    });

    it('with Form context', async function () {
      const submitMock = jest.fn();
      const wrapper = mountWithTheme(
        <Form onSubmit={submitMock}>
          <SelectAsyncField deprecatedSelectControl url="/foo/bar/" name="fieldName" />
        </Form>,
        {}
      );

      wrapper
        .find('input[id="id-fieldName"]')
        .simulate('change', {target: {value: 'baz'}});

      await tick();
      wrapper.update();

      // Is in select menu
      expect(wrapper.find('Select').prop('options')).toEqual([
        expect.objectContaining({
          value: 'baz',
          label: 'Baz Label',
        }),
      ]);

      // Select item
      wrapper.find('input[id="id-fieldName"]').simulate('keyDown', {keyCode: 13});

      // SelectControl MUST have the value object, not just a simple value
      // otherwise it means that selecting an item that has been populated in the menu by
      // an async request will not work (nothing will appear selected).
      expect(wrapper.find('SelectControl').prop('value')).toEqual({
        value: 'baz',
        label: expect.anything(),
      });

      wrapper.find('Form').simulate('submit');
      expect(submitMock).toHaveBeenCalledWith(
        {
          fieldName: 'baz',
        },
        expect.anything(),
        expect.anything()
      );
    });
  });
});
