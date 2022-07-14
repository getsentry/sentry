import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ErrorItem} from 'sentry/components/events/errorItem';

describe('Issue error item', function () {
  it('expand subitems', function () {
    render(
      <ErrorItem
        error={{
          data: {
            mapping_uuid: 'd270a1a0-1970-3c05-cb09-2cb00b4335ee',
          },
          type: 'proguard_missing_mapping',
          message: 'A proguard mapping file was missing.',
        }}
      />
    );

    expect(screen.getByText('A proguard mapping file was missing.')).toBeInTheDocument();

    expect(screen.queryByText('Mapping Uuid')).not.toBeInTheDocument();

    userEvent.click(screen.getByLabelText('Expand'));

    expect(screen.getByText('Mapping Uuid')).toBeInTheDocument();
  });
});
