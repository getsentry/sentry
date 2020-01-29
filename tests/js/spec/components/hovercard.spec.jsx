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

  // describe('shrinkToFit', function() {
  //   it('defaults to set width when shrinkToFit not specified - narrow contents', function() {
  //     const wrapper = mountWithTheme(
  //       <div>
  //         <Hovercard body={<div id="short-text">Hi!</div>}>
  //           I'm the first hover target!
  //         </Hovercard>
  //         <Hovercard
  //           body={
  //             <div id="long-text">
  //               This is a bunch of long text which is definitely going to wrap if I keep
  //               going long enough. This is a test. This is only a test. Had this been a
  //               real emergency, you'd already be dead.
  //             </div>
  //           }
  //         >
  //           I'm the second hover target!
  //         </Hovercard>
  //       </div>
  //     );

  //     wrapper
  //       .find("span[data-test-id='hover-target']")
  //       .filterWhere(element => element.text().includes('first'))
  //       .simulate('mouseEnter');
  //     jest.runAllTimers();
  //     wrapper.update();

  //     expect(
  //       wrapper
  //         .find("div[id='short-text']")
  //         .text()
  //         .includes('Hi')
  //     ).toEqual(true);
  //     console.log(wrapper.find("div[id='short-text']").getDOMNode().width);

  //   });

  //   it('defaults to set width when shrinkToFit not specified - wide contents', function() {});
  //   it('uses set width when shrinkToFit is false - narrow contents', function() {});
  //   it('uses set width when shrinkToFit is false - wide contents', function() {});
  //   it('has variable width when shrinkToFit is true - narrow contents', function() {});
  //   it('has variable width when shrinkToFit is true - wide contents', function() {});
  // });
});
