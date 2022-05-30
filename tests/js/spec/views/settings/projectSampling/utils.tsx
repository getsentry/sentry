import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import {SamplingRuleType} from 'sentry/types/sampling';
import {OrganizationContext} from 'sentry/views/organizationContext';
import Sampling from 'sentry/views/settings/project/sampling';

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

export function renderComponent({
  ruleType = SamplingRuleType.TRACE,
  withModal = true,
}: {
  ruleType?: SamplingRuleType;
  withModal?: boolean;
} = {}) {
  const {organization, project, router, routerContext} = initializeOrg({
    organization: {
      features: ['filters-and-sampling'],
    },
  } as Parameters<typeof initializeOrg>[0]);

  const {container} = render(
    <Fragment>
      {withModal && <GlobalModal />}
      <OrganizationContext.Provider value={organization}>
        <Sampling
          project={project}
          routes={router.routes}
          router={router}
          route={{}}
          location={router.location}
          routeParams={router.params}
          params={{ruleType}}
        />
      </OrganizationContext.Provider>
    </Fragment>,
    {
      context: routerContext,
    }
  );

  return {container, router};
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
