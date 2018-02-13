import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';
import AssistantCue from 'app/components/assistant/cue';

describe('AssistantCue', function() {
  it('renders', function() {
    let component = shallow(<AssistantCue cue="abc" onClick={() => 'test'} />);
    expect(toJson(component)).toMatchSnapshot();
  });
});
