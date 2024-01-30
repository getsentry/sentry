import {render} from 'sentry-test/reactTestingLibrary';

import {Banner} from './banner';

function mockIsSentryEmployee(isEmployee: boolean) {
  jest
    .spyOn(require('sentry/utils/useIsSentryEmployee'), 'useIsSentryEmployee')
    .mockImplementation(() => isEmployee);
}

describe('PII Certification Check', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('shows PII check for sentry employee users', () => {
    mockIsSentryEmployee(true);

    const {getByText} = render(
      <Banner
        onButtonClick={() => {}}
        additionalContext=""
        setAdditionalContext={() => {}}
      />
    );
    expect(getByText('Certify No PII')).toBeInTheDocument();
  });

  it('does not show PII check for non sentry employee users', () => {
    mockIsSentryEmployee(false);

    const {queryByText} = render(
      <Banner
        onButtonClick={() => {}}
        additionalContext=""
        setAdditionalContext={() => {}}
      />
    );
    expect(queryByText('Certify No PII')).not.toBeInTheDocument();
  });
});
