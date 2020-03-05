import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {selectByLabel, openMenu} from 'sentry-test/select-new';
import ColumnEditModal from 'app/views/eventsV2/table/columnEditModal';

const stubEl = props => <div>{props.children}</div>;

function mountModal({tagKeys, columns, onApply}, initialData) {
  return mountWithTheme(
    <ColumnEditModal
      Header={stubEl}
      Footer={stubEl}
      Body={stubEl}
      organization={initialData.organization}
      tagKeys={tagKeys}
      columns={columns}
      onApply={onApply}
      closeModal={() => void 0}
    />,
    initialData.routerContext
  );
}

describe('EventsV2 -> ColumnEditModal', function() {
  const initialData = initializeOrg({
    organization: {features: ['transaction-events']},
  });
  const tagKeys = ['browser.name', 'custom-field'];
  const columns = [
    {
      field: 'event.type',
    },
    {
      field: 'browser.name',
    },
    {
      field: 'id',
      aggregation: 'count',
    },
    {
      field: 'title',
      aggregation: 'count_unique',
    },
    {
      field: '',
      aggregation: 'p95',
    },
    {
      field: 'issue.id',
      ggregation: '',
    },
    {
      field: 'issue.id',
      aggregation: 'count_unique',
    },
  ];

  describe('basic rendering', function() {
    const wrapper = mountModal(
      {
        columns,
        onApply: () => void 0,
        tagKeys,
      },
      initialData
    );

    it('renders fields and basic controls', function() {
      // Should have fields equal to the columns.
      expect(wrapper.find('ColumnEditRow')).toHaveLength(columns.length);

      expect(wrapper.find('button[aria-label="Apply"]')).toHaveLength(1);
      expect(wrapper.find('button[aria-label="Add a Column"]')).toHaveLength(1);
    });

    it('renders delete and grab buttons', function() {
      expect(
        wrapper.find('RowContainer button[aria-label="Remove column"]').length
      ).toEqual(columns.length);
      expect(
        wrapper.find('RowContainer button[aria-label="Drag to reorder"]').length
      ).toEqual(columns.length);
    });
  });

  describe('rendering unknown fields', function() {
    const wrapper = mountModal(
      {
        columns: [
          {aggregation: 'count_unique', field: 'user-defined'},
          {aggregation: '', field: 'user-def'},
        ],
        onApply: () => void 0,
        tagKeys,
      },
      initialData
    );

    it('renders unknown fields in field and field parameter controls', function() {
      const funcRow = wrapper.find('ColumnEditRow').first();
      expect(funcRow.find('SelectControl[name="field"] SingleValue').text()).toBe(
        'count_unique(...)'
      );
      expect(funcRow.find('SelectControl[name="parameter"] SingleValue').text()).toBe(
        'user-defined'
      );

      const fieldRow = wrapper.find('ColumnEditRow').last();
      expect(fieldRow.find('SelectControl[name="field"] SingleValue').text()).toBe(
        'user-def'
      );

      expect(fieldRow.find('SelectControl[name="parameter"]').props().isDisabled).toBe(
        true
      );
    });
  });

  describe('rendering old field aliases', function() {
    const onApply = jest.fn();
    const wrapper = mountModal(
      {
        columns: [{aggregation: '', field: 'p95'}],
        onApply,
        tagKeys,
      },
      initialData
    );

    it('renders as an aggregate function', function() {
      const row = wrapper.find('ColumnEditRow').first();
      expect(row.find('SelectControl[name="field"] SingleValue').text()).toBe('p95(...)');
      expect(row.find('SelectControl[name="parameter"]').props().isDisabled).toBe(true);
    });

    it('updates correctly when the function is changed', function() {
      // Change the function to p99. We should not get p99(p95)
      selectByLabel(wrapper, 'p99(...)', {name: 'field', at: 0, control: true});
      wrapper.find('button[aria-label="Apply"]').simulate('click');
      expect(onApply).toHaveBeenCalledWith([{aggregation: 'p99', field: ''}]);
    });
  });

  describe('function & column selection', function() {
    const wrapper = mountModal(
      {
        columns: [columns[0]],
        onApply: () => void 0,
        tagKeys,
      },
      initialData
    );
    it('restricts column choices', function() {
      selectByLabel(wrapper, 'avg(...)', {name: 'field', at: 0, control: true});

      openMenu(wrapper, {name: 'parameter', at: 0, control: true});
      const options = wrapper
        .find('ColumnEditRow SelectControl[name="parameter"] Option')
        .map(option => option.props().label);

      expect(options).not.toContain('title');
      expect(options).toContain('transaction.duration');
    });

    it('shows no options for parameterless functions', function() {
      selectByLabel(wrapper, 'p95(...)', {name: 'field', at: 0, control: true});

      openMenu(wrapper, {name: 'parameter', at: 0, control: true});
      const parameter = wrapper.find('ColumnEditRow SelectControl[name="parameter"]');
      expect(parameter.props().isDisabled).toBe(true);
    });
  });

  describe('removing rows', function() {
    const wrapper = mountModal(
      {
        columns: [columns[0], columns[1]],
        onApply: () => void 0,
        tagKeys,
      },
      initialData
    );
    it('allows rows to be removed, but not the last one', function() {
      expect(wrapper.find('ColumnEditRow')).toHaveLength(2);
      wrapper
        .find('RowContainer button[aria-label="Remove column"]')
        .first()
        .simulate('click');

      expect(wrapper.find('ColumnEditRow')).toHaveLength(1);

      // Last row cannot be removed or dragged.
      expect(
        wrapper.find('RowContainer button[aria-label="Remove column"]')
      ).toHaveLength(0);
      expect(
        wrapper.find('RowContainer button[aria-label="Drag to reorder"]')
      ).toHaveLength(0);
    });
  });

  describe('apply action', function() {
    const onApply = jest.fn();
    const wrapper = mountModal(
      {
        columns: [columns[0], columns[1]],
        onApply,
        tagKeys,
      },
      initialData
    );
    it('reflects added and removed columns', function() {
      // Remove a column, then add a blank one an select a value in it.
      wrapper
        .find('button[aria-label="Remove column"]')
        .first()
        .simulate('click');

      wrapper.find('button[aria-label="Add a Column"]').simulate('click');
      wrapper.update();

      selectByLabel(wrapper, 'title', {name: 'field', at: 1, control: true});

      wrapper.find('button[aria-label="Apply"]').simulate('click');

      expect(onApply).toHaveBeenCalledWith([
        columns[1],
        {field: 'title', aggregation: ''},
      ]);
    });
  });
});
