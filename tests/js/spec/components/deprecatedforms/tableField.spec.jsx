import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import TableField from 'sentry/components/forms/tableField';

const mockSubmit = jest.fn();

describe('TableField', function () {
  let wrapper;
  let model;
  const columnKeys = ['column1', 'column2'];
  const columnLabels = {column1: 'Column 1', column2: 'Column 2'};

  describe('renders', function () {
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
        </Form>
      );
    });
    it('renders without form context', function () {
      wrapper = mountWithTheme(
        <TableField
          name="fieldName"
          columnKeys={columnKeys}
          columnLabels={columnLabels}
        />
      );
      expect(wrapper).toSnapshot();
    });

    it('renders with form context', function () {
      expect(wrapper).toSnapshot();
    });

    it('renders button text', function () {
      expect(wrapper.find('button[aria-label="Add Thing"]').text()).toEqual('Add Thing');
    });

    it("doesn't render columns if there's no initialData", function () {
      expect(wrapper.find('HeaderLabel').exists()).toBe(false);
    });

    describe('saves changes', function () {
      it('handles adding a new row', function () {
        wrapper.find('button[aria-label="Add Thing"]').simulate('click');
        expect(wrapper.find('HeaderLabel').at(0).text()).toBe('Column 1');
        expect(wrapper.find('HeaderLabel').at(1).text()).toBe('Column 2');
      });

      it('handles removing a row', async function () {
        // add a couple new rows for funsies
        wrapper.find('button[aria-label="Add Thing"]').simulate('click');
        wrapper.find('button[aria-label="Add Thing"]').simulate('click');

        // delete the last row
        wrapper.find('button[aria-label="delete"]').last().simulate('click');

        // click through confirmation
        const modal = await mountGlobalModal();
        modal.find('Button[data-test-id="confirm-button"]').simulate('click');
        wrapper.update();

        expect(wrapper.find('RowContainer[data-test-id="field-row"]')).toHaveLength(1);
      });
    });
  });
});
