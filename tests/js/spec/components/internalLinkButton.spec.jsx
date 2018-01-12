import React from 'react';
import {shallow} from 'enzyme';
import InternalLinkButton from 'app/components/internalLinkButton';

describe('InternalLinkButton', function() {
  it('renders', function() {
    let wrapper = shallow(
      <InternalLinkButton href="/settings/accounts/notifications">
        This is an external link button
      </InternalLinkButton>
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with icon', function() {
    let wrapper = shallow(
      <InternalLinkButton href="/settings/accounts/notifications" icon="icon-mail">
        This is an external link button
      </InternalLinkButton>
    );
    expect(wrapper).toMatchSnapshot();
  });
});
