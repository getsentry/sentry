import selectEvent from 'react-select-event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {RenderField} from 'sentry/components/forms/projectMapperField';

describe('ProjectMapperField', () => {
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

  it('clicking add updates values with current dropdown values', async () => {
    render(<RenderField {...props} />);

    await selectEvent.select(screen.getByText(/Sentry project/), 'beans');
    await selectEvent.select(screen.getByText(/Select/), 'label 1');

    userEvent.click(screen.getByLabelText('Add project'));

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
    render(<RenderField {...props} value={existingValues} />);
    userEvent.click(screen.getAllByLabelText('Delete')[0]);

    expect(onBlur).toHaveBeenCalledWith([['24', '1']], []);
    expect(onChange).toHaveBeenCalledWith([['24', '1']], []);
  });

  it('allows a single Sentry project to map to multiple items but not the value', () => {
    existingValues = [['24', '1']];
    render(<RenderField {...props} value={existingValues} />);

    // can find the same project again
    selectEvent.openMenu(screen.getByText(/Sentry project/));
    expect(screen.getAllByText('beans')).toHaveLength(2);

    // but not the value
    selectEvent.openMenu(screen.getByText('Select...'));
    expect(screen.getByText('label 1')).toBeInTheDocument();

    // validate we can still find 2
    expect(screen.getByText('label 2')).toBeInTheDocument();
  });
});
