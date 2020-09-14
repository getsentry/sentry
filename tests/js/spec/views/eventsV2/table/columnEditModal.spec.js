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
    organization: {
      features: ['performance-view'],
      apdexThreshold: 400,
    },
  });
  const tagKeys = ['browser.name', 'custom-field'];
  const columns = [
    {
      kind: 'field',
      field: 'event.type',
    },
    {
      kind: 'field',
      field: 'browser.name',
    },
    {
      kind: 'function',
      function: ['count', 'id'],
    },
    {
      kind: 'function',
      function: ['count_unique', 'title'],
    },
    {
      kind: 'function',
      function: ['p95', ''],
    },
    {
      kind: 'field',
      field: 'issue.id',
    },
    {
      kind: 'function',
      function: ['count_unique', 'issue.id'],
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
      expect(wrapper.find('QueryField')).toHaveLength(columns.length);

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
          {kind: 'function', function: ['count_unique', 'user-defined']},
          {kind: 'field', field: 'user-def'},
        ],
        onApply: () => void 0,
        tagKeys,
      },
      initialData
    );

    it('renders unknown fields in field and field parameter controls', function() {
      const funcRow = wrapper.find('QueryField').first();
      expect(
        funcRow.find('SelectControl[name="field"] [data-test-id="label"]').text()
      ).toBe('count_unique(\u2026)');
      expect(funcRow.find('SelectControl[name="parameter"] SingleValue').text()).toBe(
        'user-defined'
      );

      const fieldRow = wrapper.find('QueryField').last();
      expect(
        fieldRow.find('SelectControl[name="field"] span[data-test-id="label"]').text()
      ).toBe('user-def');
      expect(fieldRow.find('SelectControl[name="field"] Badge')).toHaveLength(1);
      expect(fieldRow.find('BlankSpace')).toHaveLength(1);
    });
  });

  describe('rendering tags that overlap fields & functions', function() {
    const wrapper = mountModal(
      {
        columns: [
          {kind: 'field', field: 'tags[project]'},
          {kind: 'field', field: 'tags[count]'},
        ],
        onApply: () => void 0,
        tagKeys: ['project', 'count'],
      },
      initialData
    );

    it('selects tag expressions that overlap fields', function() {
      const funcRow = wrapper.find('QueryField').first();
      expect(
        funcRow.find('SelectControl[name="field"] span[data-test-id="label"]').text()
      ).toBe('project');
      expect(funcRow.find('SelectControl[name="field"] Badge')).toHaveLength(1);
    });

    it('selects tag expressions that overlap functions', function() {
      const funcRow = wrapper.find('QueryField').last();
      expect(
        funcRow.find('SelectControl[name="field"] span[data-test-id="label"]').text()
      ).toBe('count');
      expect(funcRow.find('SelectControl[name="field"] Badge')).toHaveLength(1);
    });
  });

  describe('rendering functions', function() {
    const wrapper = mountModal(
      {
        columns: [
          {kind: 'function', function: ['count', 'id']},
          {kind: 'function', function: ['count_unique', 'title']},
          {kind: 'function', function: ['percentile', 'transaction.duration', '0.66']},
        ],
        onApply: () => void 0,
        tagKeys,
      },
      initialData
    );

    it('renders three columns when needed', function() {
      const countRow = wrapper.find('QueryField').first();
      // Has a select and 2 disabled inputs
      expect(countRow.find('SelectControl')).toHaveLength(1);
      expect(countRow.find('BlankSpace')).toHaveLength(2);

      const percentileRow = wrapper.find('QueryField').last();
      // two select fields, and one number input.
      expect(percentileRow.find('SelectControl')).toHaveLength(2);
      expect(percentileRow.find('BlankSpace')).toHaveLength(0);
      expect(percentileRow.find('StyledInput[inputMode="numeric"]')).toHaveLength(1);
    });
  });

  describe('function & column selection', function() {
    let onApply, wrapper;
    beforeEach(function() {
      onApply = jest.fn();
      wrapper = mountModal(
        {
          columns: [columns[0]],
          onApply,
          tagKeys,
        },
        initialData
      );
    });

    it('restricts column choices', function() {
      selectByLabel(wrapper, 'avg(\u2026)', {name: 'field', at: 0, control: true});

      openMenu(wrapper, {name: 'parameter', at: 0, control: true});
      const options = wrapper
        .find('QueryField SelectControl[name="parameter"] Option')
        .map(option => option.props().label);

      expect(options).not.toContain('title');
      expect(options).toContain('transaction.duration');
    });

    it('shows no options for parameterless functions', function() {
      selectByLabel(wrapper, 'p95()', {name: 'field', at: 0, control: true});

      expect(wrapper.find('QueryField BlankSpace')).toHaveLength(1);
    });

    it('shows additional inputs for multi-parameter functions', function() {
      selectByLabel(wrapper, 'percentile(\u2026)', {name: 'field', at: 0, control: true});

      // Parameter select should display and use the default value.
      const field = wrapper.find('QueryField SelectControl[name="parameter"]');
      expect(field.find('SingleValue').text()).toBe('transaction.duration');

      // Input should show and have default value.
      const refinement = wrapper.find('QueryField input[inputMode="numeric"]');
      expect(refinement.props().value).toBe('0.5');
    });

    it('handles scalar field parameters', function() {
      selectByLabel(wrapper, 'apdex(\u2026)', {name: 'field', at: 0, control: true});

      // Parameter select should display and use the default value.
      const field = wrapper.find('QueryField input[name="refinement"]');
      expect(field.props().value).toBe('400');

      // Trigger a blur and make sure the column is not wrong.
      field.simulate('blur');

      // Apply the changes so we can see the new columns.
      wrapper.find('Button[priority="primary"]').simulate('click');
      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['apdex', '400', undefined]},
      ]);
    });

    it('clears unused parameters', function() {
      // Choose percentile, then apdex which has fewer parameters and different types.
      selectByLabel(wrapper, 'percentile(\u2026)', {name: 'field', at: 0, control: true});
      selectByLabel(wrapper, 'apdex(\u2026)', {name: 'field', at: 0, control: true});

      // Apply the changes so we can see the new columns.
      wrapper.find('Button[priority="primary"]').simulate('click');
      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['apdex', '400', undefined]},
      ]);
    });

    it('clears all unused parameters', function() {
      // Choose percentile, then failure_rate which has no parameters.
      selectByLabel(wrapper, 'percentile(\u2026)', {name: 'field', at: 0, control: true});
      selectByLabel(wrapper, 'failure_rate()', {name: 'field', at: 0, control: true});

      // Apply the changes so we can see the new columns.
      wrapper.find('Button[priority="primary"]').simulate('click');
      expect(onApply).toHaveBeenCalledWith([
        {kind: 'function', function: ['failure_rate', '', undefined]},
      ]);
    });
  });

  describe('adding rows', function() {
    const wrapper = mountModal(
      {
        columns: [columns[0]],
        onApply: () => void 0,
        tagKeys,
      },
      initialData
    );
    it('allows rows to be added, but only up to 20', function() {
      for (let i = 2; i <= 20; i++) {
        wrapper.find('button[aria-label="Add a Column"]').simulate('click');
        expect(wrapper.find('QueryField')).toHaveLength(i);
      }
      expect(
        wrapper.find('button[aria-label="Add a Column"]').prop('aria-disabled')
      ).toBe(true);
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
      expect(wrapper.find('QueryField')).toHaveLength(2);
      wrapper
        .find('RowContainer button[aria-label="Remove column"]')
        .first()
        .simulate('click');

      expect(wrapper.find('QueryField')).toHaveLength(1);

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

      expect(onApply).toHaveBeenCalledWith([columns[1], {kind: 'field', field: 'title'}]);
    });
  });
});
