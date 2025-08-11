import type {ComponentProps} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import FormModel from 'sentry/components/forms/model';

import {RenderField} from './projectMapperField';

describe('ProjectMapperField', () => {
  const defaultProps: ComponentProps<typeof RenderField> = {
    mappedDropdown: {
      placeholder: 'mapped-dropdown-placeholder',
      items: [
        {value: 1, label: 'label 1', url: ''},
        {value: 2, label: 'label 2', url: ''},
        {value: 3, label: 'label 3', url: ''},
      ],
    },
    nextButton: {
      text: 'next',
      allowedDomain: '',
    },
    sentryProjects: [
      {id: 23, slug: 'cool', platform: 'javascript', name: 'Cool'},
      {id: 24, slug: 'beans', platform: 'python', name: 'Beans'},
    ],
    model: new FormModel(),
    name: '',
    iconType: '',
    type: 'project_mapper',

    value: [[23, 2]],
    onChange: jest.fn(),
    onBlur: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('clicking add updates values with current dropdown values', async () => {
    render(<RenderField {...defaultProps} />);

    await selectEvent.select(screen.getByText(/Sentry project/), 'beans');
    await selectEvent.select(screen.getByText('mapped-dropdown-placeholder'), 'label 1');

    await userEvent.click(screen.getByLabelText('Add project'));

    expect(defaultProps.onBlur).toHaveBeenCalledWith(
      [
        [23, 2],
        [24, 1],
      ],
      []
    );
    expect(defaultProps.onChange).toHaveBeenCalledWith(
      [
        [23, 2],
        [24, 1],
      ],
      []
    );
  });

  it('can delete item', async () => {
    render(
      <RenderField
        {...defaultProps}
        value={[
          [23, 2],
          [24, 1],
        ]}
      />
    );
    await userEvent.click(screen.getAllByLabelText('Delete')[0]!);

    expect(defaultProps.onBlur).toHaveBeenCalledWith([[24, 1]], []);
    expect(defaultProps.onChange).toHaveBeenCalledWith([[24, 1]], []);
  });

  it('allows a single Sentry project to map to multiple items but not the value', async () => {
    render(<RenderField {...defaultProps} value={[[24, 1]]} />);

    // can find the same project again
    await selectEvent.openMenu(screen.getByText(/Sentry project/));
    expect(screen.getAllByText('beans')).toHaveLength(2);

    // but not the value
    await selectEvent.openMenu(screen.getByText('mapped-dropdown-placeholder'));
    expect(screen.getByText('label 1')).toBeInTheDocument();

    // validate we can still find 2
    expect(screen.getByText('label 2')).toBeInTheDocument();
  });
});
