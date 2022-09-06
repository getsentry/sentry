import {mountWithTheme} from 'sentry-test/enzyme';
import {findOption, openMenu, selectByValue} from 'sentry-test/select-new';

import {RenderField} from 'sentry/components/forms/projectMapperField';

describe('ProjectMapperField', () => {
  let wrapper;
  const mappedDropdown = {
    placholder: 'hi',
    items: [
      {value: '1', label: 'label 1'},
      {value: '2', label: 'label 2'},
      {value: '3', label: 'label 3'},
    ],
  };

  const sentryProjects = [
    {id: '23', slug: 'cool', platform: 'javascript', name: 'Cool'},
    {id: '24', slug: 'beans', platform: 'python', name: 'Beans'},
  ];
  let onBlur, onChange, props, existingValues;

  beforeEach(() => {
    existingValues = [['23', '2']];
    onBlur = jest.fn();
    onChange = jest.fn();
    props = {
      mappedDropdown,
      sentryProjects,
      nextButton: {
        url: 'https://vercel.com/dashboard/integrations/icfg_fuqLnwH3IYmcpAKAWY8eoYlR',
        next: 'Return to Vercel',
      },
      value: existingValues,
      onChange,
      onBlur,
    };
  });

  it('clicking add updates values with current dropdown values', () => {
    wrapper = mountWithTheme(<RenderField {...props} />);
    selectByValue(wrapper, '24', {control: true, name: 'project'});
    selectByValue(wrapper, '1', {control: true, name: 'mappedDropdown'});

    wrapper.find('AddProjectWrapper Button').simulate('click');

    expect(onBlur).toHaveBeenCalledWith(
      [
        ['23', '2'],
        ['24', '1'],
      ],
      []
    );
    expect(onChange).toHaveBeenCalledWith(
      [
        ['23', '2'],
        ['24', '1'],
      ],
      []
    );
  });

  it('can delete item', () => {
    existingValues = [
      ['23', '2'],
      ['24', '1'],
    ];
    wrapper = mountWithTheme(<RenderField {...props} value={existingValues} />);
    wrapper.find('Button[aria-label="Delete"]').first().simulate('click');

    expect(onBlur).toHaveBeenCalledWith([['24', '1']], []);
    expect(onChange).toHaveBeenCalledWith([['24', '1']], []);
  });

  it('allows a single Sentry project to map to multiple items but not the value', () => {
    existingValues = [['24', '1']];
    wrapper = mountWithTheme(<RenderField {...props} value={existingValues} />);
    // can find the same project again
    openMenu(wrapper, {control: true, name: 'project'});
    expect(
      findOption(wrapper, {value: '24'}, {control: true, name: 'project'})
    ).toHaveLength(1);
    // but not the value
    openMenu(wrapper, {control: true, name: 'mappedDropdown'});
    expect(
      findOption(wrapper, {value: '1'}, {control: true, name: 'mappedDropdown'})
    ).toHaveLength(0);
    // validate we can still find 2
    expect(
      findOption(wrapper, {value: '2'}, {control: true, name: 'mappedDropdown'})
    ).toHaveLength(1);
  });
});
