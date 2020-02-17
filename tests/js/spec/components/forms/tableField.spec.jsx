import {mountWithTheme} from 'sentry-test/enzyme';
import React from 'react';

import Form from 'app/views/settings/components/forms/form';
import FormModel from 'app/views/settings/components/forms/model';
import TableField from 'app/views/settings/components/forms/tableField';

const mockSubmit = jest.fn();

describe('TableField', function() {
  let wrapper;
  let model;
  const columnKeys = ['column1', 'column2'];
  const columnLabels = {column1: 'Column 1', column2: 'Column 2'};

  describe('renders', function() {
    beforeEach(() => {
      model = new FormModel();
      wrapper = mountWithTheme(
        <Form onSubmit={mockSubmit} model={model}>
          <TableField
            name="fieldName"
            columnKeys={columnKeys}
            columnLabels={columnLabels}
            addButtonText="Add Thing"
          />
        </Form>,
        TestStubs.routerContext()
      );
    });
    it('renders without form context', function() {
      wrapper = mountWithTheme(
        <TableField
          name="fieldName"
          columnKeys={columnKeys}
          columnLabels={columnLabels}
        />,
        TestStubs.routerContext()
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with form context', function() {
      expect(wrapper).toMatchSnapshot();
    });

    it('renders button text', function() {
      expect(wrapper.find('Button[icon="icon-circle-add"]').text()).toEqual('Add Thing');
    });

    it("doesn't render columns if there's no initalData", function() {
      expect(wrapper.find('HeaderLabel').exists()).toBe(false);
    });

    describe('saves changes', function() {
      it('handles adding a new row', function() {
        wrapper.find('Button[icon="icon-circle-add"]').simulate('click');
        expect(
          wrapper
            .find('HeaderLabel')
            .at(0)
            .text()
        ).toBe('Column 1');
        expect(
          wrapper
            .find('HeaderLabel')
            .at(1)
            .text()
        ).toBe('Column 2');
      });

      it('handles removing a row', function() {
        // add a couple new rows for funsies
        wrapper.find('Button[icon="icon-circle-add"]').simulate('click');
        wrapper.find('Button[icon="icon-circle-add"]').simulate('click');

        // delete the last row
        wrapper
          .find('Button[icon="icon-trash"]')
          .last()
          .simulate('click');

        expect(wrapper.find('RowContainer[data-test-id="field-row"]')).toHaveLength(1);
      });
    });
  });
});
