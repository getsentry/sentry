import {useComboBoxState} from '@react-stately/combobox';
import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AskSeer} from 'sentry/components/searchQueryBuilder/askSeer';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {FieldKind} from 'sentry/utils/fields';

// Mock the useOption hook to avoid the "Unknown list" error
jest.mock('@react-aria/listbox', () => ({
  ...jest.requireActual('@react-aria/listbox'),
  useOption: jest.fn(() => ({
    optionProps: {
      role: 'option',
      'aria-selected': false,
      'aria-disabled': false,
    },
    labelProps: {},
    isFocused: false,
    isPressed: false,
  })),
}));

function MockComboBoxComponent() {
  const comboBoxState = useComboBoxState({
    items: [{id: 1, name: 'one'}],
    disabledKeys: [],
  });

  return (
    <SearchQueryBuilderProvider
      filterKeys={{id: {key: 'id', name: 'ID', kind: FieldKind.FIELD}}}
      getTagValues={() => Promise.resolve([])}
      initialQuery=""
      searchSource=""
      enableAISearch
    >
      <AskSeer state={comboBoxState} />
    </SearchQueryBuilderProvider>
  );
}

describe('AskSeer', () => {
  it('renders ask seer button when user has given consent', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
      }),
    });

    render(<MockComboBoxComponent />, {
      organization: {features: ['gen-ai-features', 'gen-ai-explore-traces']},
    });

    const askSeer = await screen.findByRole('option', {name: /Ask Seer/});
    expect(askSeer).toBeInTheDocument();
  });

  it('renders enable ai button when user has not given consent', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: false,
          userHasAcknowledged: false,
        },
      }),
    });

    render(<MockComboBoxComponent />, {
      organization: {features: ['gen-ai-features', 'gen-ai-explore-traces']},
    });

    const enableAi = await screen.findByText(/Enable Gen AI/);
    expect(enableAi).toBeInTheDocument();
  });

  describe('user clicks on enable gen ai button', () => {
    it('calls promptsUpdate', async () => {
      const organization = OrganizationFixture();
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/seer/setup-check/',
        body: AutofixSetupFixture({
          setupAcknowledgement: {
            orgHasAcknowledged: false,
            userHasAcknowledged: false,
          },
        }),
      });

      const promptsUpdateMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/prompts-activity/`,
        method: 'PUT',
      });

      render(<MockComboBoxComponent />, {
        organization: {features: ['gen-ai-features', 'gen-ai-explore-traces']},
      });

      const enableAi = await screen.findByText(/Enable Gen AI/);
      expect(enableAi).toBeInTheDocument();

      await userEvent.click(enableAi);

      await waitFor(() => {
        expect(promptsUpdateMock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              feature: 'seer_autofix_setup_acknowledged',
              organization_id: organization.id,
              project_id: undefined,
              status: 'dismissed',
            },
          })
        );
      });
    });
  });
});
