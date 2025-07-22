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
        'Extrapolated based on 100 span samples'
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
        'Top 5 groups extrapolated based on 100 span samples'
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

      expect(screen.getByTestId('wrapper')).toHaveTextContent(
        'Extrapolated based on 100 span samples'
      );
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
        'Top 5 groups extrapolated based on 100 span samples'
      );
    });
  });
});
