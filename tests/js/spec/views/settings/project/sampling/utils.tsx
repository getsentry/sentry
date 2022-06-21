import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import {Organization} from 'sentry/types';
import {SamplingRuleType} from 'sentry/types/sampling';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';
import Sampling from 'sentry/views/settings/project/sampling';

export function renderComponent({
  orgOptions,
  ruleType = SamplingRuleType.TRACE,
  withModal = true,
}: {
  orgOptions?: Partial<Organization>;
  ruleType?: SamplingRuleType;
  withModal?: boolean;
} = {}) {
  const {organization, project, router, routerContext} = initializeOrg({
    organization: orgOptions || {
      features: ['filters-and-sampling'],
    },
  } as Parameters<typeof initializeOrg>[0]);

  const {container} = render(
    <Fragment>
      {withModal && (
        <RouteContext.Provider
          value={{
            router,
            location: router.location,
            params: {},
            routes: [],
          }}
        >
          <GlobalModal />
        </RouteContext.Provider>
      )}
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

export async function openSamplingRuleModal(actionElement: HTMLElement) {
  userEvent.click(actionElement);
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toBeInTheDocument();
}
