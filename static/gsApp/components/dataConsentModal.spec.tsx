import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';

import DataConsentModal from 'getsentry/components/dataConsentModal';

describe('Data Consent Modal', function () {
  const closeModal = jest.fn();
  const organization = OrganizationFixture();

  it('renders modal', async function () {
    render(
      <DataConsentModal
        closeModal={closeModal}
        Body={ModalBody}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
      />
    );

    expect(
      await screen.findByText('Help Sentry be more opinionated')
    ).toBeInTheDocument();
  });

  it('agree button work correctly', async function () {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-consent/`,
      method: 'PUT',
      body: {aggregatedDataConsent: true},
    });

    render(
      <DataConsentModal
        closeModal={closeModal}
        Body={ModalBody}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
      />
    );

    expect(await screen.findByText('I agree')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'I agree'}));

    expect(closeModal).toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('maybe later button work correctly', async function () {
    render(
      <DataConsentModal
        closeModal={closeModal}
        Body={ModalBody}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
      />
    );

    expect(await screen.findByText('Maybe later')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Maybe later'}));

    expect(closeModal).toHaveBeenCalled();
  });
});
