import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfidenceFooter} from './confidenceFooter';

function Wrapper({children}: {children: React.ReactNode}) {
  return <div data-test-id="wrapper">{children}</div>;
}

describe('ConfidenceFooter', () => {
  it('loading', () => {
    render(<ConfidenceFooter extrapolate={false} />, {wrapper: Wrapper});
    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
  });

  describe('unextrapolated', () => {
    it('loaded without top events', () => {
      render(<ConfidenceFooter extrapolate={false} sampleCount={100} />, {
        wrapper: Wrapper,
      });
      expect(screen.getByTestId('wrapper')).toHaveTextContent('Span count: 100');
    });

    it('loaded with top events', () => {
      render(<ConfidenceFooter extrapolate={false} sampleCount={100} topEvents={5} />, {
        wrapper: Wrapper,
      });
      expect(screen.getByTestId('wrapper')).toHaveTextContent(
        'Span count for top 5 groups: 100'
      );
    });
  });

  describe('unsampled', () => {
    it('loaded without top events', () => {
      render(<ConfidenceFooter isSampled={false} sampleCount={100} />, {
        wrapper: Wrapper,
      });
      expect(screen.getByTestId('wrapper')).toHaveTextContent('Span count: 100');
    });

    it('loaded with top events', () => {
      render(<ConfidenceFooter isSampled={false} sampleCount={100} topEvents={5} />, {
        wrapper: Wrapper,
      });
      expect(screen.getByTestId('wrapper')).toHaveTextContent(
        'Span count for top 5 groups: 100'
      );
    });
  });

  describe('without raw counts', () => {
    describe('low confidence', () => {
      it('loaded 1', async () => {
        render(<ConfidenceFooter sampleCount={1} confidence="low" />, {
          wrapper: Wrapper,
        });
        expect(screen.getByTestId('wrapper')).toHaveTextContent('Estimated from 1 span');
        await userEvent.hover(
          screen.getByText((_, element) => element?.textContent === '1 span')
        );
        expect(
          await screen.findByText(
            /You may not have enough span samples for a high accuracy estimation of your query./
          )
        ).toBeInTheDocument();
      });

      it('loaded 1 with grouping', async () => {
        render(<ConfidenceFooter sampleCount={1} confidence="low" topEvents={5} />, {
          wrapper: Wrapper,
        });
        expect(screen.getByTestId('wrapper')).toHaveTextContent(
          'Estimated for top 5 groups from 1 span'
        );
        await userEvent.hover(
          screen.getByText((_, element) => element?.textContent === '1 span')
        );
        expect(
          await screen.findByText(
            /You may not have enough span samples for a high accuracy estimation of your query./
          )
        ).toBeInTheDocument();
      });

      it('loaded 10', async () => {
        render(<ConfidenceFooter sampleCount={10} confidence="low" />, {
          wrapper: Wrapper,
        });
        expect(screen.getByTestId('wrapper')).toHaveTextContent(
          'Estimated from 10 spans'
        );
        await userEvent.hover(
          screen.getByText((_, element) => element?.textContent === '10 spans')
        );
        expect(
          await screen.findByText(
            /You may not have enough span samples for a high accuracy estimation of your query./
          )
        ).toBeInTheDocument();
      });

      it('loaded 10 with grouping', async () => {
        render(<ConfidenceFooter sampleCount={10} confidence="low" topEvents={5} />, {
          wrapper: Wrapper,
        });
        expect(screen.getByTestId('wrapper')).toHaveTextContent(
          'Estimated for top 5 groups from 10 spans'
        );
        await userEvent.hover(
          screen.getByText((_, element) => element?.textContent === '10 spans')
        );
        expect(
          await screen.findByText(
            /You may not have enough span samples for a high accuracy estimation of your query./
          )
        ).toBeInTheDocument();
      });
    });

    describe('high confidence', () => {
      it('loaded 1', () => {
        render(<ConfidenceFooter sampleCount={1} confidence="high" />, {
          wrapper: Wrapper,
        });
        expect(screen.getByTestId('wrapper')).toHaveTextContent('Estimated from 1 span');
      });

      it('loaded 1 with grouping', () => {
        render(<ConfidenceFooter sampleCount={1} confidence="high" topEvents={5} />, {
          wrapper: Wrapper,
        });
        expect(screen.getByTestId('wrapper')).toHaveTextContent(
          'Estimated for top 5 groups from 1 span'
        );
      });

      it('loaded 10', () => {
        render(<ConfidenceFooter sampleCount={10} confidence="high" />, {
          wrapper: Wrapper,
        });
        expect(screen.getByTestId('wrapper')).toHaveTextContent(
          'Estimated from 10 spans'
        );
      });

      it('loaded 10 with grouping', () => {
        render(<ConfidenceFooter sampleCount={10} confidence="high" topEvents={5} />, {
          wrapper: Wrapper,
        });
        expect(screen.getByTestId('wrapper')).toHaveTextContent(
          'Estimated for top 5 groups from 10 spans'
        );
      });
    });
  });

  describe('with raw counts', () => {
    const rawSpanCounts = {
      normal: {
        count: 100,
        isLoading: false,
      },
      highAccuracy: {
        count: 1000,
        isLoading: false,
      },
    };

    describe('without user query', () => {
      describe('partial scan', () => {
        describe('low confidence', () => {
          it('loaded 1', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={1}
                confidence="low"
                dataScanned="partial"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 1 sample of 1k spans'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '1 sample')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });

          it('loaded 1 with grouping', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={1}
                confidence="low"
                dataScanned="partial"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 1 sample of 1k spans'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '1 sample')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });

          it('loaded 10', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={10}
                confidence="low"
                dataScanned="partial"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 10 samples of 1k spans'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '10 samples')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });

          it('loaded 10 with grouping', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={10}
                confidence="low"
                dataScanned="partial"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 10 samples of 1k spans'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '10 samples')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });
        });

        describe('high confidence', () => {
          it('loaded 1', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={1}
                confidence="high"
                dataScanned="partial"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 1 sample of 1k spans'
            );
          });

          it('loaded 1 with grouping', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={1}
                confidence="high"
                dataScanned="partial"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 1 sample of 1k spans'
            );
          });

          it('loaded 10', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={10}
                confidence="high"
                dataScanned="partial"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 10 samples of 1k spans'
            );
          });

          it('loaded 10 with grouping', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={10}
                confidence="high"
                dataScanned="partial"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 10 samples of 1k spans'
            );
          });
        });
      });

      describe('full scan', () => {
        describe('low confidence', () => {
          it('loaded 1', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={1}
                confidence="low"
                dataScanned="full"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 1 span'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '1 span')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });

          it('loaded 1 with grouping', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={1}
                confidence="low"
                dataScanned="full"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 1 span'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '1 span')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });

          it('loaded 10', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={10}
                confidence="low"
                dataScanned="full"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 10 spans'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '10 spans')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });

          it('loaded 10 with grouping', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={10}
                confidence="low"
                dataScanned="full"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 10 spans'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '10 spans')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });
        });

        describe('high confidence', () => {
          it('loaded 1', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={1}
                confidence="high"
                dataScanned="full"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 1 span'
            );
          });

          it('loaded 1 with grouping', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={1}
                confidence="high"
                dataScanned="full"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 1 span'
            );
          });

          it('loaded 10', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={10}
                confidence="high"
                dataScanned="full"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 10 spans'
            );
          });

          it('loaded 10 with grouping', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                sampleCount={10}
                confidence="high"
                dataScanned="full"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 10 spans'
            );
          });
        });
      });
    });

    describe('with user query', () => {
      describe('partial scan', () => {
        describe('low confidence', () => {
          it('loaded 1', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={1}
                confidence="low"
                dataScanned="partial"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 1 match after scanning 100 samples of 1k spans'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '1 match')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });

          it('loaded 1 with grouping', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={1}
                confidence="low"
                dataScanned="partial"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 1 match after scanning 100 samples of 1k spans'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '1 match')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });

          it('loaded 10', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={10}
                confidence="low"
                dataScanned="partial"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 10 matches after scanning 100 samples of 1k spans'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '10 matches')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });

          it('loaded 10 with grouping', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={10}
                confidence="low"
                dataScanned="partial"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 10 matches after scanning 100 samples of 1k spans'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '10 matches')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });
        });

        describe('high confidence', () => {
          it('loaded 1', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={1}
                confidence="high"
                dataScanned="partial"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 1 match after scanning 100 samples of 1k spans'
            );
          });

          it('loaded 1 with grouping', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={1}
                confidence="high"
                dataScanned="partial"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 1 match after scanning 100 samples of 1k spans'
            );
          });

          it('loaded 10', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={10}
                confidence="high"
                dataScanned="partial"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 10 matches after scanning 100 samples of 1k spans'
            );
          });

          it('loaded 10 with grouping', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={10}
                confidence="high"
                dataScanned="partial"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 10 matches after scanning 100 samples of 1k spans'
            );
          });
        });
      });

      describe('full scan', () => {
        describe('low confidence', () => {
          it('loaded 1', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={1}
                confidence="low"
                dataScanned="full"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 1 match of 1k spans'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '1 match')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });

          it('loaded 1 with grouping', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={1}
                confidence="low"
                dataScanned="full"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 1 match of 1k spans'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '1 match')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });

          it('loaded 10', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={10}
                confidence="low"
                dataScanned="full"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 10 matches of 1k spans'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '10 matches')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });

          it('loaded 10 with grouping', async () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={10}
                confidence="low"
                dataScanned="full"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 10 matches of 1k spans'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '10 matches')
            );
            expect(
              await screen.findByText(
                /You may not have enough span samples for a high accuracy estimation of your query./
              )
            ).toBeInTheDocument();
          });
        });

        describe('high confidence', () => {
          it('loaded 1', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={1}
                confidence="high"
                dataScanned="full"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 1 match of 1k spans'
            );
          });

          it('loaded 1 with grouping', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={1}
                confidence="high"
                dataScanned="full"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 1 match of 1k spans'
            );
          });

          it('loaded 10', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={10}
                confidence="high"
                dataScanned="full"
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 10 matches of 1k spans'
            );
          });

          it('loaded 10 with grouping', () => {
            render(
              <ConfidenceFooter
                rawSpanCounts={rawSpanCounts}
                userQuery="query"
                sampleCount={10}
                confidence="high"
                dataScanned="full"
                topEvents={5}
              />,
              {wrapper: Wrapper}
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 10 matches of 1k spans'
            );
          });
        });
      });
    });
  });
});
