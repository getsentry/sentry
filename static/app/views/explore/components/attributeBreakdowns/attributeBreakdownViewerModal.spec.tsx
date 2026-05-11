import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {closeModal} from 'sentry/actionCreators/modal';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';

import AttributeBreakdownViewerModal from './attributeBreakdownViewerModal';

jest.mock('sentry/actionCreators/modal');

jest.mock('echarts-for-react/lib/core', () => {
  return jest.fn(({style}) => {
    return <div style={{...style, background: 'green'}}>echarts mock</div>;
  });
});

const stubEl = (props: {children?: React.ReactNode}) => <div>{props.children}</div>;

const mockCloseModal = jest.mocked(closeModal);

const stubProps = {
  Header: stubEl,
  Footer: stubEl as ModalRenderProps['Footer'],
  Body: stubEl as ModalRenderProps['Body'],
  CloseButton: stubEl,
  closeModal: mockCloseModal,
};

describe('AttributeBreakdownViewerModal', () => {
  beforeEach(() => {
    mockCloseModal.mockClear();
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(() => Promise.resolve()),
      },
    });
  });

  describe('single mode', () => {
    const mockAttributeDistribution = {
      attributeName: 'browser.name',
      values: [
        {label: 'Chrome', value: 500},
        {label: 'Firefox', value: 300},
        {label: 'Safari', value: 200},
      ],
    };

    const mockCohortCount = 1000;

    it('renders the modal with attribute name as title', () => {
      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="single"
          attributeDistribution={mockAttributeDistribution}
          cohortCount={mockCohortCount}
          query=""
        />
      );

      expect(screen.getByRole('heading', {name: 'browser.name'})).toBeInTheDocument();
    });

    it('renders the population percentage indicator', () => {
      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="single"
          attributeDistribution={mockAttributeDistribution}
          cohortCount={mockCohortCount}
          query=""
        />
      );

      // Total values: 500 + 300 + 200 = 1000, cohortCount = 1000 => 100%
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('renders the chart', () => {
      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="single"
          attributeDistribution={mockAttributeDistribution}
          cohortCount={mockCohortCount}
          query=""
        />
      );

      expect(screen.getByText('echarts mock')).toBeInTheDocument();
    });

    it('renders the table with attribute values', () => {
      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="single"
          attributeDistribution={mockAttributeDistribution}
          cohortCount={mockCohortCount}
          query=""
        />
      );

      // Table should have column headers
      expect(screen.getByRole('columnheader', {name: 'Value'})).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: 'Count'})).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: 'Percentage'})).toBeInTheDocument();

      // Table should have attribute values
      expect(screen.getByRole('cell', {name: 'Chrome'})).toBeInTheDocument();
      expect(screen.getByRole('cell', {name: 'Firefox'})).toBeInTheDocument();
      expect(screen.getByRole('cell', {name: 'Safari'})).toBeInTheDocument();
    });

    it('calculates percentage correctly', () => {
      const cohortCount = 1000;
      const attributeDistribution = {
        attributeName: 'test.attribute',
        values: [{label: 'Value A', value: 250}],
      };

      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="single"
          attributeDistribution={attributeDistribution}
          cohortCount={cohortCount}
          query=""
        />
      );

      expect(screen.getByRole('cell', {name: '25%'})).toBeInTheDocument();
    });

    it('handles zero cohort count without crashing', () => {
      const cohortCount = 0;
      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="single"
          attributeDistribution={mockAttributeDistribution}
          cohortCount={cohortCount}
          query=""
        />
      );

      expect(screen.getByRole('heading', {name: 'browser.name'})).toBeInTheDocument();
    });

    it('handles empty values array', () => {
      const attributeDistribution = {
        attributeName: 'empty.attribute',
        values: [],
      };
      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="single"
          attributeDistribution={attributeDistribution}
          cohortCount={mockCohortCount}
          query=""
        />
      );

      expect(screen.getByRole('heading', {name: 'empty.attribute'})).toBeInTheDocument();
      expect(screen.queryByText('echarts mock')).not.toBeInTheDocument();
    });
  });

  describe('comparison mode', () => {
    const mockAttribute = {
      attributeName: 'browser.name',
      cohort1: [
        {label: 'Chrome', value: 500},
        {label: 'Firefox', value: 300},
      ],
      cohort2: [
        {label: 'Chrome', value: 400},
        {label: 'Firefox', value: 350},
        {label: 'Safari', value: 250},
      ],
      order: {
        rrf: 0.5,
        rrr: 0.3,
      },
    };

    const mockCohort1Total = 800;
    const mockCohort2Total = 1000;

    it('renders the modal with attribute name as title', () => {
      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="comparison"
          attribute={mockAttribute}
          cohort1Total={mockCohort1Total}
          cohort2Total={mockCohort2Total}
          query=""
        />
      );

      expect(screen.getByRole('heading', {name: 'browser.name'})).toBeInTheDocument();
    });

    it('renders population percentage indicators for both cohorts', () => {
      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="comparison"
          attribute={mockAttribute}
          cohort1Total={mockCohort1Total}
          cohort2Total={mockCohort2Total}
          query=""
        />
      );

      // Cohort 1: (500 + 300) / 800 = 100%
      // Cohort 2: (400 + 350 + 250) / 1000 = 100%
      expect(screen.getAllByText('100%')).toHaveLength(2);
    });

    it('renders the chart', () => {
      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="comparison"
          attribute={mockAttribute}
          cohort1Total={mockCohort1Total}
          cohort2Total={mockCohort2Total}
          query=""
        />
      );

      expect(screen.getByText('echarts mock')).toBeInTheDocument();
    });

    it('renders the table with cohort comparison columns', () => {
      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="comparison"
          attribute={mockAttribute}
          cohort1Total={mockCohort1Total}
          cohort2Total={mockCohort2Total}
          query=""
        />
      );

      // Table should have column headers
      expect(screen.getByRole('columnheader', {name: 'Value'})).toBeInTheDocument();
      expect(
        screen.getByRole('columnheader', {name: 'Selected Count'})
      ).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: 'Selected %'})).toBeInTheDocument();
      expect(
        screen.getByRole('columnheader', {name: 'Baseline Count'})
      ).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: 'Baseline %'})).toBeInTheDocument();
    });

    it('renders attribute values in the table', () => {
      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="comparison"
          attribute={mockAttribute}
          cohort1Total={mockCohort1Total}
          cohort2Total={mockCohort2Total}
          query=""
        />
      );

      // Table should have attribute values
      expect(screen.getByRole('cell', {name: 'Chrome'})).toBeInTheDocument();
      expect(screen.getByRole('cell', {name: 'Firefox'})).toBeInTheDocument();
      expect(screen.getByRole('cell', {name: 'Safari'})).toBeInTheDocument();
    });

    it('handles zero cohort totals without crashing', () => {
      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="comparison"
          attribute={mockAttribute}
          cohort1Total={0}
          cohort2Total={0}
          query=""
        />
      );

      expect(screen.getByRole('heading', {name: 'browser.name'})).toBeInTheDocument();
    });

    it('handles empty cohorts', () => {
      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="comparison"
          attribute={{
            attributeName: 'empty.attribute',
            cohort1: [],
            cohort2: [],
            order: {rrf: 0, rrr: 0},
          }}
          cohort1Total={mockCohort1Total}
          cohort2Total={mockCohort2Total}
          query=""
        />
      );

      expect(screen.getByRole('heading', {name: 'empty.attribute'})).toBeInTheDocument();
      expect(screen.queryByText('echarts mock')).not.toBeInTheDocument();
    });
  });

  describe('cell actions', () => {
    const mockAttributeDistribution = {
      attributeName: 'browser.name',
      values: [
        {label: 'Chrome', value: 500},
        {label: 'Firefox', value: 300},
      ],
    };

    const mockCohortCount = 1000;

    it('allows cell actions for Value column', async () => {
      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="single"
          attributeDistribution={mockAttributeDistribution}
          cohortCount={mockCohortCount}
          query=""
        />
      );

      const cells = screen.getAllByRole('cell');
      // First cell should be the Value column (Chrome)
      const valueCell = cells[0]!;
      const valueCellButton = within(valueCell).getByRole('button');
      await userEvent.click(valueCellButton);

      // Verify all expected menu items are present
      expect(await screen.findByText('View span samples')).toBeInTheDocument();
      expect(screen.getByText('Add to filter')).toBeInTheDocument();
      expect(screen.getByText('Exclude from filter')).toBeInTheDocument();
      expect(screen.getByText('Copy to clipboard')).toBeInTheDocument();
    });

    it('does not allow cell actions for non-Value columns', () => {
      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="single"
          attributeDistribution={mockAttributeDistribution}
          cohortCount={mockCohortCount}
          query=""
        />
      );

      const cells = screen.getAllByRole('cell');
      // Count column should be the second cell (500)
      const countCell = cells[1]!;
      // Non-Value columns should not have action buttons
      expect(within(countCell).queryByRole('button')).not.toBeInTheDocument();
    });

    it('navigates correctly when OPEN_ROW_IN_EXPLORE action is triggered', async () => {
      const {router} = render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="single"
          attributeDistribution={mockAttributeDistribution}
          cohortCount={mockCohortCount}
          query=""
        />
      );

      const cells = screen.getAllByRole('cell');
      const valueCell = cells[0]!;
      const valueCellButton = within(valueCell).getByRole('button');
      await userEvent.click(valueCellButton);

      const menuOption = await screen.findByText('View span samples');
      await userEvent.click(menuOption);

      await waitFor(() => expect(router.location.pathname).toContain('/explore/traces/'));
      expect(router.location.query.query).toContain('browser.name:Chrome');
      expect(mockCloseModal).toHaveBeenCalled();
    });

    it('navigates with attribute_breakdowns table when ADD action is triggered', async () => {
      const {router} = render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="single"
          attributeDistribution={mockAttributeDistribution}
          cohortCount={mockCohortCount}
          query=""
        />
      );

      const cells = screen.getAllByRole('cell');
      const valueCell = cells[0]!;
      const valueCellButton = within(valueCell).getByRole('button');
      await userEvent.click(valueCellButton);

      const menuOption = await screen.findByText('Add to filter');
      await userEvent.click(menuOption);

      await waitFor(() => expect(router.location.pathname).toContain('/explore/traces/'));
      expect(router.location.query.table).toBe('attribute_breakdowns');
      expect(router.location.query.query).toContain('browser.name:Chrome');
      expect(mockCloseModal).toHaveBeenCalled();
    });

    it('navigates with negated filter when EXCLUDE action is triggered', async () => {
      const {router} = render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="single"
          attributeDistribution={mockAttributeDistribution}
          cohortCount={mockCohortCount}
          query=""
        />
      );

      const cells = screen.getAllByRole('cell');
      const valueCell = cells[0]!;
      const valueCellButton = within(valueCell).getByRole('button');
      await userEvent.click(valueCellButton);

      const menuOption = await screen.findByText('Exclude from filter');
      await userEvent.click(menuOption);

      await waitFor(() => expect(router.location.pathname).toContain('/explore/traces/'));
      expect(router.location.query.table).toBe('attribute_breakdowns');
      expect(router.location.query.query).toContain('!browser.name:Chrome');
      expect(mockCloseModal).toHaveBeenCalled();
    });

    it('copies value to clipboard when COPY_TO_CLIPBOARD action is triggered', async () => {
      const writeTextMock = jest.fn(() => Promise.resolve());
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="single"
          attributeDistribution={mockAttributeDistribution}
          cohortCount={mockCohortCount}
          query=""
        />
      );

      const cells = screen.getAllByRole('cell');
      const valueCell = cells[0]!;
      const valueCellButton = within(valueCell).getByRole('button');
      await userEvent.click(valueCellButton);

      const menuOption = await screen.findByText('Copy to clipboard');
      await userEvent.click(menuOption);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith('Chrome');
      });
      expect(mockCloseModal).toHaveBeenCalled();
    });

    it('works correctly in comparison mode', async () => {
      const mockAttribute = {
        attributeName: 'browser.name',
        cohort1: [
          {label: 'Chrome', value: 500},
          {label: 'Firefox', value: 300},
        ],
        cohort2: [
          {label: 'Chrome', value: 400},
          {label: 'Firefox', value: 350},
        ],
        order: {
          rrf: 0.5,
          rrr: 0.3,
        },
      };

      const {router} = render(
        <AttributeBreakdownViewerModal
          {...stubProps}
          mode="comparison"
          attribute={mockAttribute}
          cohort1Total={800}
          cohort2Total={750}
          query=""
        />
      );

      const cells = screen.getAllByRole('cell');
      const valueCell = cells[0]!;
      const valueCellButton = within(valueCell).getByRole('button');
      await userEvent.click(valueCellButton);

      const menuOption = await screen.findByText('View span samples');
      await userEvent.click(menuOption);

      await waitFor(() => expect(router.location.pathname).toContain('/explore/traces/'));
      expect(router.location.query.query).toContain('browser.name:Chrome');
      expect(mockCloseModal).toHaveBeenCalled();
    });
  });
});
