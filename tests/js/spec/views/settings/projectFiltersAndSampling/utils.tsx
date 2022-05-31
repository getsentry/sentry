import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import {OrganizationContext} from 'sentry/views/organizationContext';
import FiltersAndSampling from 'sentry/views/settings/project/filtersAndSampling';

export const commonConditionCategories = [
  'Release',
  'Environment',
  'User Id',
  'User Segment',
  'Browser Extensions',
  'Localhost',
  'Legacy Browser',
  'Web Crawlers',
  'IP Address',
  'Content Security Policy',
  'Error Message',
  'Transaction',
];

export function renderComponent(withModal = true) {
  const {organization, project} = initializeOrg({
    organization: {
      features: ['filters-and-sampling'],
    },
  } as Parameters<typeof initializeOrg>[0]);

  return render(
    <Fragment>
      {withModal && <GlobalModal />}
      <OrganizationContext.Provider value={organization}>
        <FiltersAndSampling project={project} />
      </OrganizationContext.Provider>
    </Fragment>
  );
}

export async function renderModal(actionElement: HTMLElement, takeScreenshot = false) {
  // Open Modal
  userEvent.click(actionElement);
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toBeInTheDocument();

  if (takeScreenshot) {
    expect(dialog).toSnapshot();
  }
}
