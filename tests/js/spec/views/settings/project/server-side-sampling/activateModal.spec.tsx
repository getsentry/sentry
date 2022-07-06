import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
  within,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import * as indicators from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import GlobalModal from 'sentry/components/globalModal';
import {ActivateModal} from 'sentry/views/settings/project/server-side-sampling/modals/activateModal';
import {SERVER_SIDE_SAMPLING_DOC_LINK} from 'sentry/views/settings/project/server-side-sampling/utils';

import {getMockData, uniformRule} from './utils';

describe('Server-side Sampling - Activate Modal', function () {
  it('renders modal', async function () {
    const newRule = {
      ...uniformRule,
      id: 0,
      active: true,
    };

    const {project, organization} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [uniformRule],
          },
        }),
      ],
    });

    const saveMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [newRule],
        },
      }),
    });

    jest.spyOn(indicators, 'addSuccessMessage');

    render(<GlobalModal />);

    openModal(modalProps => (
      <ActivateModal
        {...modalProps}
        ruleId={uniformRule.id}
        rules={[uniformRule]}
        orgSlug={organization.slug}
        projSlug={project.slug}
      />
    ));

    // Dialog Header
    expect(screen.getByRole('heading', {name: 'Activate Rule'})).toBeInTheDocument();

    // Dialog Content
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'Applying server-side sampling without first updating the Sentry SDK versions could sharply decrease the amount of accepted transactions. Resolve now.'
        )
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Check to agree'})).not.toBeChecked();
    expect(screen.getByText(/I understand the consequences/)).toBeInTheDocument();

    // Dialog Footer
    expect(
      within(screen.getByRole('dialog')).getByRole('button', {name: 'Read Docs'})
    ).toHaveAttribute('href', SERVER_SIDE_SAMPLING_DOC_LINK);
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Activate Rule'})).toBeDisabled();

    // Agree with consequences
    userEvent.click(screen.getByRole('checkbox', {name: 'Check to agree'}));
    expect(
      screen.getByRole('checkbox', {name: 'Uncheck to disagree'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Activate Rule'})).toBeEnabled();

    // Submit form
    userEvent.click(screen.getByRole('button', {name: 'Activate Rule'}));

    // Dialog should close
    await waitForElementToBeRemoved(() =>
      screen.queryByRole('heading', {name: 'Activate Rule'})
    );

    expect(saveMock).toHaveBeenCalledTimes(1);

    expect(saveMock).toHaveBeenLastCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({
        data: {
          dynamicSampling: {
            rules: [newRule],
          },
        },
      })
    );

    expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
      'Successfully activated sampling rule'
    );
  });
});
