import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {IntegratedOrgSelector} from 'sentry/components/codecov/integratedOrgPicker/integratedOrgSelector';

describe('IntegratedOrgSelector', function () {
  it('renders when given integrated org', async function () {
    render(
      <IntegratedOrgSelector
        chosenOrg="my-other-org-with-a-super-long-name"
        onChange={() => {}}
      />
    );
    expect(
      await screen.findByRole('button', {name: 'my-other-org-with-a-super-long-name'})
    ).toBeInTheDocument();
  });

  it('renders the chosen org as the first option', async function () {
    render(
      <IntegratedOrgSelector
        chosenOrg="my-other-org-with-a-super-long-name"
        onChange={() => {}}
      />
    );

    const button = await screen.findByRole('button', {
      name: 'my-other-org-with-a-super-long-name',
    });
    await userEvent.click(button);
    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveTextContent('my-other-org-with-a-super-long-name');
  });
});
