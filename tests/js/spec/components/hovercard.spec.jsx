import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';
import Hovercard from 'app/components/hovercard';

jest.useFakeTimers();

describe('Hovercard', function() {
  const hoverToShowHovercard = wrapper => {
    wrapper.find("span[data-test-id='hover-target']").simulate('mouseEnter');
    jest.runAllTimers();
    wrapper.update();
  };

  const unhoverToHideHovercard = wrapper => {
    wrapper.find("span[data-test-id='hover-target']").simulate('mouseLeave');
    jest.runAllTimers();
    wrapper.update();
  };

  it('shows on mouseenter', function() {
    const wrapper = mountWithTheme(
      <Hovercard
        body={
          <div id="hovercard-text">
            This is a hovercard! It has some text on it. Dogs are great and cats are okay,
            too.
          </div>
        }
      >
        Hover over me to show the card!
      </Hovercard>
    );

    hoverToShowHovercard(wrapper);

    expect(wrapper.state().visible).toBe(true);
    expect(
      wrapper
        .find("div[id='hovercard-text']")
        .text()
        .includes('Dogs are great')
    ).toEqual(true);
  });

  it('hides on mouseleave', function() {
    const wrapper = mountWithTheme(
      <Hovercard
        body={
          <div>
            This is a hovercard! It has some text on it. Dogs are great and cats are okay,
            too.
          </div>
        }
      >
        <span id="hover-target">Hover over me to show the card!</span>
      </Hovercard>
    );

    // ensure that hovercard is visible before mouseLeave event, to prove that
    // the mouseleave is actually actively *hiding* it (as opposed to it never
    // having shown up in the first place)
    hoverToShowHovercard(wrapper);
    expect(wrapper.state().visible).toBe(true);

    // now mouseleave and check that the hovercard disappears
    unhoverToHideHovercard(wrapper);
    expect(wrapper.state().visible).toBe(false);
    expect(wrapper.contains("div[id='hovercard-text']")).toEqual(false);
  });
});
