import {DataScrubbingRelayPiiConfig} from 'sentry-fixture/dataScrubbingRelayPiiConfig';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {convertRelayPiiConfig} from 'sentry/views/settings/components/dataScrubbing/convertRelayPiiConfig';
import Rules from 'sentry/views/settings/components/dataScrubbing/rules';

const relayPiiConfig = convertRelayPiiConfig(
  JSON.stringify(DataScrubbingRelayPiiConfig())
);

describe('Rules', function () {
  it('default render', function () {
    render(<Rules rules={relayPiiConfig} onEditRule={jest.fn()} />);

    expect(screen.getAllByRole('button', {name: 'Edit Rule'})).toHaveLength(3);

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          '[Replace] [[a-zA-Z0-9]+] with [Placeholder] from [$message]'
        )
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText('[Mask] [Credit card numbers] from [$message]')
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          '[Replace] [Password fields] with [Scrubbed] from [password]'
        )
      )
    ).toBeInTheDocument();
  });

  it('render edit button only', function () {
    render(<Rules rules={relayPiiConfig} onEditRule={jest.fn()} />);

    expect(screen.getAllByRole('button', {name: 'Edit Rule'})).toHaveLength(3);

    expect(screen.queryByRole('button', {name: 'Delete Rule'})).not.toBeInTheDocument();
  });

  it('render delete button only', function () {
    render(<Rules rules={relayPiiConfig} onDeleteRule={jest.fn()} />);

    expect(screen.getAllByRole('button', {name: 'Delete Rule'})).toHaveLength(3);

    expect(screen.queryByRole('button', {name: 'Edit Rule'})).not.toBeInTheDocument();
  });
});
