import React from 'react';
import {mount, shallow} from 'enzyme';
import Accordion from 'app/components/accordion';

describe('Accordion', function() {
  let routerContext = TestStubs.routerContext();

  it('renders', function() {
    let component = shallow(
      <Accordion priority="primary" size="large" labelClosed="Show More" cutoff={2}>
        <div key="1" />
        <div key="2" />
        <div key="3" />
      </Accordion>
    );
    expect(component).toMatchSnapshot();
  });

  it('has a working cutoff', function() {
    let component = shallow(
      <Accordion priority="primary" size="large" labelClosed="Show More" cutoff={1}>
        <div data-test-id="accordion-count" key="1" />
        <div data-test-id="accordion-count" key="2" />
        <div data-test-id="accordion-count" key="3" />
      </Accordion>
    );
    expect(component.find('[data-test-id="accordion-count"]')).toHaveLength(1);
  });

  it('opens', function() {
    let component = mount(
      <Accordion priority="primary" size="large" labelClosed="Show More" cutoff={1}>
        <div data-test-id="accordion-count" key="1" />
        <div data-test-id="accordion-count" key="2" />
        <div data-test-id="accordion-count" key="3" />
      </Accordion>,
      routerContext
    );
    component.find('Button').simulate('click');
    expect(component.find('[data-test-id="accordion-count"]')).toHaveLength(3);
  });

  it('closes', function() {
    let component = mount(
      <Accordion priority="primary" size="large" labelClosed="Show More" cutoff={1}>
        <div data-test-id="accordion-count" key="1" />
        <div data-test-id="accordion-count" key="2" />
        <div data-test-id="accordion-count" key="3" />
      </Accordion>,
      routerContext
    );
    component
      .find('Button')
      .simulate('click')
      .simulate('click');
    expect(component.find('[data-test-id="accordion-count"]')).toHaveLength(1);
  });
});
