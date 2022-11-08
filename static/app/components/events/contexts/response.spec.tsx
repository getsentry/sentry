import {render, screen} from 'sentry-test/reactTestingLibrary';

import ResponseContextComponent from './response';

describe('ResponseContextComponent', () => {
  it('renders body size, headers, and status code', () => {
    render(
      <ResponseContextComponent
        alias="response"
        event={TestStubs.Event()}
        data={{
          ['body_size']: '8610',
          headers: [['test-key', 'test-value']],
          ['status_code']: '200',
        }}
      />
    );

    expect(screen.getByText('Body Size')).toBeInTheDocument();
    expect(screen.getByText('8610')).toBeInTheDocument();
    expect(screen.getByText('Headers')).toBeInTheDocument();
    expect(screen.getByText('test-key')).toBeInTheDocument();
    expect(screen.getByText('test-value')).toBeInTheDocument();
    expect(screen.getByText('Status Code')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });
});
