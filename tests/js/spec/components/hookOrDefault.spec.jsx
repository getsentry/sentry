import React from 'react';
import {mount, shallow} from 'enzyme';
import HookStore from 'app/stores/hookStore';
import HookOrDefault from 'app/components/HookOrDefault';
import OrganizationAuth from 'app/views/settings/organizationAuth/index';

describe('HookOrDefault', function() {
  const Wrapper = function Wrapper(props) {
    return <div prop1='prop1' />;
  };
  const Wrapper2 = function Wrapper(props) {
    return <div {...props} />;
  };
  const routerContext = TestStubs.routerContext();

  // beforeEach(function() {
  //   HookStore.add('test-meeee', () => {
  //     return (
  //       <Wrapper key="initial"/>


  //     );
  //   });
  // });

  // afterEach(function() {
  //   // Clear HookStore
  //   HookStore.init();
  // });


  it('renders', function() {
    function sum(a, b) {
      console.log('in here')
      return a + b;
    }
    console.log(sum(1,2))
    let result = HookOrDefault({hookName:'test-me', defaultComponent: OrganizationAuth});
    console.log(result);
    // console.log(<result />)
    // console.log(OrganizationAuth)
    // console.log(<OrganizationAuth />);
    // let wrapper = mount(
    //   <div>
    //     <result organization={TestStubs.Organization()} />
    //   </div>,
    //   routerContext
    // );

    // let wrapper = shallow(<result />);
    // console.log(wrapper.debug(), result)

    // expect(wrapper).toMatchSnapshot();
  });


});
