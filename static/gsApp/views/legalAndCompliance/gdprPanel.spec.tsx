import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {GDPRPanel} from './gdprPanel';

describe('GDPRPanel', () => {
  it('does not display edit button if user does not have access', () => {
    const organization = OrganizationFixture({access: []});
    render(<GDPRPanel subscription={SubscriptionFixture({organization})} />, {
      organization,
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(
      screen.getAllByText('There is no information on file for this contact.')
    ).toHaveLength(2);
  });

  it('renders contact details', () => {
    const organization = OrganizationFixture({access: ['org:billing']});
    const subscription = SubscriptionFixture({
      organization,
      gdprDetails: {
        euRepName: 'John Doe',
        euRepAddress: '123 Fake St.',
        euRepPhone: '123-456-7890',
        euRepEmail: 'void@sentry.io',
        dpoName: '',
        dpoAddress: '',
        dpoPhone: '',
        dpoEmail: '',
      },
    });
    render(<GDPRPanel subscription={subscription} />, {organization});
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('updates contact details', async () => {
    const organization = OrganizationFixture({access: ['org:billing']});
    const subscription = SubscriptionFixture({organization});

    const mockUpdateContact = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/customers/org-slug/',
      body: {
        ...subscription,
        gdprDetails: {
          euRepName: 'John Doe',
          euRepAddress: '123 Fake St.',
          euRepPhone: '123-456-7890',
          euRepEmail: 'void@sentry.io',
          dpoName: '',
          dpoAddress: '',
          dpoPhone: '',
          dpoEmail: '',
        },
      },
    });

    render(<GDPRPanel subscription={subscription} />, {organization});
    renderGlobalModal();

    // Not currently shown to people with access to  update it
    expect(
      screen.queryByText('There is no information on file for this contact.')
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getAllByRole('button', {name: 'Add Contact Details'})[0]!
    );

    await userEvent.type(screen.getByRole('textbox', {name: 'Full Name'}), 'John Doe');
    await userEvent.type(screen.getByRole('textbox', {name: 'Address'}), '123 Fake St.');
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Phone Number'}),
      '123-456-7890'
    );
    await userEvent.type(screen.getByRole('textbox', {name: 'Email'}), 'void@sentry.io');
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() =>
      expect(mockUpdateContact).toHaveBeenCalledWith(
        '/customers/org-slug/',
        expect.objectContaining({
          data: {
            gdprDetails: {
              euRepAddress: '123 Fake St.',
              euRepEmail: 'void@sentry.io',
              euRepName: 'John Doe',
              euRepPhone: '123-456-7890',
            },
          },
        })
      )
    );
  });
});
