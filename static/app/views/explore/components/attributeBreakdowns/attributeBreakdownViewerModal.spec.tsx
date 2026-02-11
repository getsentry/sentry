import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';

import AttributeBreakdownViewerModal from './attributeBreakdownViewerModal';

jest.mock('echarts-for-react/lib/core', () => {
  return jest.fn(({style}) => {
    return <div style={{...style, background: 'green'}}>echarts mock</div>;
  });
});

const stubEl = (props: {children?: React.ReactNode}) => <div>{props.children}</div>;

const stubProps = {
  Header: stubEl,
  Footer: stubEl as ModalRenderProps['Footer'],
  Body: stubEl as ModalRenderProps['Body'],
  CloseButton: stubEl,
  closeModal: () => undefined,
};

describe('AttributeBreakdownViewerModal', () => {
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
        />
      );

      expect(screen.getByRole('heading', {name: 'empty.attribute'})).toBeInTheDocument();
      expect(screen.queryByText('echarts mock')).not.toBeInTheDocument();
    });
  });
});
