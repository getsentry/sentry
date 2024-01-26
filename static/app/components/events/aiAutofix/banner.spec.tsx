import {ConfigFixture} from 'sentry-fixture/config';
import {UserFixture} from 'sentry-fixture/user';

import {render} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import {Banner} from './banner';

describe('PII Certification Check', () => {
  it('shows PII check for staff users', () => {
    ConfigStore.config = ConfigFixture({
      user: UserFixture({isStaff: true}),
    });

    const {getByText} = render(
      <Banner
        onButtonClick={() => {}}
        additionalContext=""
        setAdditionalContext={() => {}}
      />
    );
    expect(getByText('Certify No PII')).toBeInTheDocument();
  });

  it('does not show PII check for non-staff users', () => {
    ConfigStore.config = ConfigFixture({
      user: UserFixture({isStaff: false}),
    });

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
