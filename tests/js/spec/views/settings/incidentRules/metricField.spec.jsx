import React from 'react';

import {openMenu, selectByLabel} from 'sentry-test/select-new';
import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import Form from 'app/views/settings/components/forms/form';
import MetricField from 'app/views/settings/incidentRules/metricField';
import {Dataset} from 'app/views/settings/incidentRules/types';

describe('MetricField', function() {
  const {organization} = initializeOrg({
    organization: {features: ['transaction-events']},
  });

  it('renders', function() {
    mountWithTheme(
      <Form initialData={{dataset: Dataset.ERRORS}}>
        <MetricField name="metric" organization={organization} />
      </Form>
    );
  });

  it('has a select subset of error fields', function() {
    const wrapper = mountWithTheme(
      <Form initialData={{dataset: Dataset.ERRORS}}>
        <MetricField name="metric" organization={organization} />
      </Form>
    );
    openMenu(wrapper, {selector: 'QueryField'});

    // two error aggregation configs
    expect(wrapper.find('Option Option')).toHaveLength(2);

    // Select count_unique and verify the tags
    selectByLabel(wrapper, 'count_unique(…)', {selector: 'QueryField'});
    openMenu(wrapper, {selector: 'QueryField', at: 1});

    expect(
      wrapper
        .find('SelectControl')
        .at(1)
        .find('Option')
    ).toHaveLength(1);
  });

  it('has a select subset of transaction fields', function() {
    const wrapper = mountWithTheme(
      <Form initialData={{dataset: Dataset.TRANSACTIONS}}>
        <MetricField name="metric" organization={organization} />
      </Form>
    );
    openMenu(wrapper, {selector: 'QueryField'});

    // 10 error aggregate configs
    expect(wrapper.find('Option Option')).toHaveLength(10);

    selectByLabel(wrapper, 'avg(…)', {selector: 'QueryField'});
    openMenu(wrapper, {selector: 'QueryField', at: 1});

    expect(
      wrapper
        .find('SelectControl')
        .at(1)
        .find('Option')
    ).toHaveLength(1);
  });

  it('maps field value to selected presets', function() {
    const wrapper = mountWithTheme(
      <Form initialData={{dataset: Dataset.TRANSACTIONS}}>
        <MetricField name="metric" organization={organization} />
      </Form>
    );
    selectByLabel(wrapper, 'error_rate()', {selector: 'QueryField'});

    expect(wrapper.find('FieldHelp Button[isSelected=true]').text()).toEqual(
      'Error rate'
    );

    selectByLabel(wrapper, 'p95()', {selector: 'QueryField'});

    expect(wrapper.find('FieldHelp Button[isSelected=true]').text()).toEqual('Latency');
  });

  it('changes field values when selecting presets', function() {
    const wrapper = mountWithTheme(
      <Form initialData={{dataset: Dataset.TRANSACTIONS}}>
        <MetricField name="metric" organization={organization} />
      </Form>
    );

    wrapper.find('FieldHelp button[aria-label="Error rate"]').simulate('click');

    expect(wrapper.find('QueryField SingleValue SingleValue').text()).toEqual(
      'error_rate()'
    );
  });
});
