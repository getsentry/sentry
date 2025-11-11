import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfidenceFooter} from './confidenceFooter';

function Wrapper({children}: {children: React.ReactNode}) {
  return <div data-test-id="wrapper">{children}</div>;
}

describe('ConfidenceFooter', () => {
  describe('low confidence', () => {
    it('renders for full scan without grouping', async () => {
      render(
        <ConfidenceFooter
          confidence="low"
          sampleCount={100}
          topEvents={undefined}
          dataScanned="full"
        />,
        {wrapper: Wrapper}
      );

      expect(screen.getByTestId('wrapper')).toHaveTextContent(
        'Extrapolated from 100 spans'
      );
      await userEvent.hover(screen.getByText('100'));
      expect(
        await screen.findByText(
          /You may not have enough span samples for a high accuracy extrapolation of your query./
        )
      ).toBeInTheDocument();
    });
    it('renders for full scan with grouping', async () => {
      render(
        <ConfidenceFooter
          confidence="low"
          sampleCount={100}
          topEvents={5}
          dataScanned="full"
        />,
        {wrapper: Wrapper}
      );

      expect(screen.getByTestId('wrapper')).toHaveTextContent(
        'Extrapolated from 100 spans for top 5 groups'
      );
      await userEvent.hover(screen.getByText('100'));
      expect(
        await screen.findByText(
          /You may not have enough span samples for a high accuracy extrapolation of your query./
        )
      ).toBeInTheDocument();
    });
  });

  describe('high confidence', () => {
    it('renders for full scan without grouping', () => {
      render(
        <ConfidenceFooter
          confidence="high"
          sampleCount={100}
          topEvents={undefined}
          dataScanned="full"
        />,
        {wrapper: Wrapper}
      );

      expect(screen.getByTestId('wrapper')).toHaveTextContent('Span count: 100');
    });
    it('renders for full scan with grouping', () => {
      render(
        <ConfidenceFooter
          confidence="high"
          sampleCount={100}
          topEvents={5}
          dataScanned="full"
        />,
        {wrapper: Wrapper}
      );

      expect(screen.getByTestId('wrapper')).toHaveTextContent(
        'Span count for top 5 groups: 100'
      );
    });
  });

  describe('unextrapolated', () => {
    it('unextrapolated loading', () => {
      render(<ConfidenceFooter extrapolate={false} />, {wrapper: Wrapper});

      expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
    });

    it('unextrapolated loaded', () => {
      render(<ConfidenceFooter extrapolate={false} sampleCount={100} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByTestId('wrapper')).toHaveTextContent('Span count: 100');
    });

    it('unextrapolated loaded with grouping', () => {
      render(<ConfidenceFooter extrapolate={false} sampleCount={100} topEvents={5} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByTestId('wrapper')).toHaveTextContent(
        'Span count for top 5 groups: 100'
      );
    });
  });
});
