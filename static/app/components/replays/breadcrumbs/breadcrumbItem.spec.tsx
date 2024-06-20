import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';

const MOCK_FRAME = {
  timestamp: new Date(1718818835397),
  type: 'default',
  category: 'ui.click',
  message:
    'div.app-pv36ag.e151korg0 > IntegrationRow > FlexContainer > TitleContainer > IntegrationName',
  data: {
    nodeId: 6889,
    node: {
      id: 6889,
      tagName: 'a',
      textContent: '',
      attributes: {
        class: 'app-3jkjlw ek2xunm6',
        'data-sentry-component': 'IntegrationName',
      },
    },
  },
  offsetMs: 208397,
  timestampMs: 1718818835397,
};

const MOCK_EXTRACTION = {
  frame: MOCK_FRAME,
  html: '<a data-sentry-element="IntegrationName" data-sentry-source-file="integrationRow.tsx" class="app-3jkjlw ek2xunm6" href="https://pelpr-org.sentry.io/settings/integrations/msteams/">********* *****</a>',
  timestamp: 1718818835397,
};

describe('BreadcrumbItem', function () {
  const organization = OrganizationFixture({features: ['new-timeline-ui']});

  it('displays the breadcrumb item', async function () {
    const mockClick = jest.fn();
    const mockMouseEnter = jest.fn();
    const mockMouseLeave = jest.fn();
    render(
      <BreadcrumbItem
        extraction={MOCK_EXTRACTION}
        frame={MOCK_FRAME}
        onMouseEnter={mockMouseEnter}
        onMouseLeave={mockMouseLeave}
        onClick={mockClick}
        onInspectorExpanded={() => {}}
        startTimestampMs={MOCK_FRAME.timestampMs}
      />,
      {organization}
    );

    const title = screen.getByText('User Click');
    expect(title).toBeInTheDocument();
    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(screen.getByText('IntegrationName')).toBeInTheDocument();

    await userEvent.hover(title);
    expect(mockMouseEnter).toHaveBeenCalled();
    await userEvent.unhover(title);
    expect(mockMouseLeave).toHaveBeenCalled();
    await userEvent.click(title);
    expect(mockClick).toHaveBeenCalled();
  });
});
