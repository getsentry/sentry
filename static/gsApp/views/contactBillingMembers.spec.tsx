import {MemberFixture} from 'sentry-fixture/member';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContactBillingMembers from './contactBillingMembers';

describe('ContactBillingMembers', () => {
  it('renders helpful members', async () => {
    const member = MemberFixture();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/`,
      method: 'GET',
      body: [member],
    });

    render(<ContactBillingMembers />);
    expect(await screen.findByText(/Maybe a billing admin/)).toHaveTextContent(
      // Text is broken up by a link
      `Maybe a billing admin (${member.email}) could help?`
    );
  });

  it('does not render helpful members', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/`,
      method: 'GET',
      body: [],
    });

    render(<ContactBillingMembers />);
    expect(
      await screen.findByText(
        `You don't have access to manage billing and subscription details.`
      )
    ).toBeInTheDocument();
  });
});
