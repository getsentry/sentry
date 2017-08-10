import React from 'react';
import {mount, shallow} from 'enzyme';
import Button from 'app/components/buttons/button';

describe('Button', function() {
  it('renders', function() {
    let component = shallow(<Button primary large>Button</Button>);
    expect(component).toMatchSnapshot();
  });

  it('renders react-router link', function() {
    let component = shallow(<Button to="/some/route">Router Link</Button>);
    expect(component).toMatchSnapshot();
  });

  it('renders normal link', function() {
    let component = shallow(<Button href="/some/relative/url">Normal Link</Button>);
    expect(component).toMatchSnapshot();
  });

  it('calls `onClick` callback', function() {
    let spy = jest.fn();
    let component = mount(<Button onClick={spy} />);
    component.simulate('click');

    expect(spy).toHaveBeenCalled();
  });

  it('does not call `onClick` on disabled buttons', function() {
    let spy = jest.fn();
    let component = mount(<Button onClick={spy} disabled />);
    component.simulate('click');

    expect(spy).not.toHaveBeenCalled();
  });
});
