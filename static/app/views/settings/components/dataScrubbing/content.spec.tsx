import {render, screen} from 'sentry-test/reactTestingLibrary';

import Content from 'sentry/views/settings/components/dataScrubbing/content';
import convertRelayPiiConfig from 'sentry/views/settings/components/dataScrubbing/convertRelayPiiConfig';

describe('Content', function () {
  it('default empty', function () {
    render(<Content rules={[]} onEditRule={jest.fn()} onDeleteRule={jest.fn()} />);

    expect(screen.getByText('You have no data scrubbing rules')).toBeInTheDocument();
  });

  it('render rules', function () {
    render(
      <Content
        rules={convertRelayPiiConfig(
          JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig())
        )}
        onEditRule={jest.fn()}
        onDeleteRule={jest.fn()}
      />
    );

    expect(screen.getAllByRole('button', {name: 'Edit Rule'})).toHaveLength(3);
  });
});
