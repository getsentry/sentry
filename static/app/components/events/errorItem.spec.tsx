import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ErrorItem} from 'sentry/components/events/errorItem';

describe('Issue error item', function () {
  it('expand subitems', async function () {
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

    await userEvent.click(screen.getByLabelText('Expand'));

    expect(screen.getByText('Mapping Uuid')).toBeInTheDocument();
  });

  it('display redacted data', async function () {
    render(
      <ErrorItem
        error={{
          data: {
            image_path: '',
            image_uuid: '6b77ffb6-5aba-3b5f-9171-434f9660f738',
            message: '',
          },
          message: 'A required debug information file was missing.',
          type: 'native_missing_dsym',
        }}
        meta={{
          image_path: {'': {rem: [['project:2', 's', 0, 0]], len: 117}},
        }}
      />
    );

    await userEvent.click(screen.getByLabelText('Expand'));

    expect(screen.getByText('File Name')).toBeInTheDocument();
    expect(screen.getByText('File Path')).toBeInTheDocument();
    expect(screen.getAllByText(/redacted/)).toHaveLength(2);

    await userEvent.hover(screen.getAllByText(/redacted/)[0]!);

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Replaced because of a data scrubbing rule in your project's settings"
        )
      ) // Fall back case
    ).toBeInTheDocument(); // tooltip description
  });
});
