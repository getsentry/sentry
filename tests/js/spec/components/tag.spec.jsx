import {mountWithTheme} from 'sentry-test/enzyme';

import {IconFire} from 'app/icons';
import Tag from 'app/components/tag';

describe('Tag', function () {
  it('basic', function () {
    const wrapper = mountWithTheme(<Tag>Text</Tag>);
    expect(wrapper.text()).toEqual('Text');
  });

  it('with icon', function () {
    const wrapper = mountWithTheme(
      <Tag icon={<IconFire />} type="error">
        Error
      </Tag>
    );
    expect(wrapper.text()).toEqual('Error');
    expect(wrapper.find('Background').prop('type')).toEqual('error');
    expect(wrapper.find('IconFire').exists()).toBeTruthy();
  });

  it('with tooltip', function () {
    const wrapper = mountWithTheme(
      <Tag type="highlight" tooltipText="lorem ipsum">
        Tooltip
      </Tag>
    );
    expect(wrapper.text()).toEqual('Tooltip');
    expect(wrapper.find('Tooltip').prop('title')).toEqual('lorem ipsum');
  });

  it('with dismiss', function () {
    const mockCallback = jest.fn();

    const wrapper = mountWithTheme(
      <Tag type="highlight" onDismiss={mockCallback}>
        Dismissable
      </Tag>
    );
    expect(wrapper.text()).toEqual('Dismissable');
    expect(wrapper.find('IconClose').exists()).toBeTruthy();

    expect(mockCallback).toHaveBeenCalledTimes(0);
    wrapper.find('DismissButton').simulate('click');
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('with internal link', function () {
    const to = '/organizations/sentry/issues/';
    const wrapper = mountWithTheme(
      <Tag type="highlight" to={to}>
        Internal link
      </Tag>
    );
    expect(wrapper.text()).toEqual('Internal link');
    expect(wrapper.find('IconOpen').exists()).toBeTruthy();
    expect(wrapper.find('Link').prop('to')).toEqual(to);
  });

  it('with external link', function () {
    const href = 'https://sentry.io/';
    const wrapper = mountWithTheme(
      <Tag type="highlight" href={href}>
        External link
      </Tag>
    );
    expect(wrapper.text()).toEqual('External link');
    expect(wrapper.find('IconOpen').exists()).toBeTruthy();
    expect(wrapper.find('a').props()).toEqual(
      expect.objectContaining({
        href,
        target: '_blank',
        rel: 'noreferrer noopener',
      })
    );
  });

  it('overrides a link default icon', function () {
    const wrapper1 = mountWithTheme(<Tag href="#">1</Tag>);
    const wrapper2 = mountWithTheme(
      <Tag href="#" icon={null}>
        2
      </Tag>
    );
    const wrapper3 = mountWithTheme(
      <Tag href="#" icon={<IconFire />}>
        3
      </Tag>
    );

    expect(wrapper1.find('IconOpen').exists()).toBeTruthy();
    expect(wrapper2.find('IconOpen').exists()).toBeFalsy();
    expect(wrapper3.find('IconOpen').exists()).toBeFalsy();
    expect(wrapper3.find('IconFire').exists()).toBeTruthy();
  });
});
