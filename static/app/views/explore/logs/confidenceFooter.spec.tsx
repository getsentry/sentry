import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import {ChartType} from 'sentry/views/insights/common/components/chart';

import {ConfidenceFooter} from './confidenceFooter';

function Wrapper({children}: {children: React.ReactNode}) {
  return <div data-test-id="wrapper">{children}</div>;
}

describe('ConfidenceFooter', () => {
  const rawLogCounts = {
    normal: {
      count: 100,
      isLoading: false,
    },
    highAccuracy: {
      count: 1000,
      isLoading: false,
    },
  };

  function chartInfo(info: Partial<ChartInfo>) {
    return {
      chartType: ChartType.LINE,
      series: [],
      timeseriesResult: {} as any,
      yAxis: '',
      ...info,
    };
  }

  it('loading', () => {
    render(
      <ConfidenceFooter
        rawLogCounts={rawLogCounts}
        chartInfo={chartInfo({})}
        hasUserQuery={false}
        isLoading
      />,
      {wrapper: Wrapper}
    );
    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
  });

  describe('with raw counts', () => {
    describe('unsampled', () => {
      describe('without user query', () => {
        it('loaded without top events', () => {
          render(
            <ConfidenceFooter
              rawLogCounts={rawLogCounts}
              chartInfo={chartInfo({sampleCount: 100, isSampled: false})}
              hasUserQuery={false}
              isLoading={false}
            />,
            {
              wrapper: Wrapper,
            }
          );
          expect(screen.getByTestId('wrapper')).toHaveTextContent('100 logs');
        });

        it('loaded with top events', () => {
          render(
            <ConfidenceFooter
              rawLogCounts={rawLogCounts}
              chartInfo={chartInfo({sampleCount: 100, isSampled: false, topEvents: 5})}
              hasUserQuery={false}
              isLoading={false}
            />,
            {
              wrapper: Wrapper,
            }
          );
          expect(screen.getByTestId('wrapper')).toHaveTextContent(
            '100 logs for top 5 groups'
          );
        });
      });

      describe('with user query', () => {
        it('loaded without top events', () => {
          render(
            <ConfidenceFooter
              rawLogCounts={rawLogCounts}
              chartInfo={chartInfo({sampleCount: 100, isSampled: false})}
              hasUserQuery
              isLoading={false}
            />,
            {
              wrapper: Wrapper,
            }
          );
          expect(screen.getByTestId('wrapper')).toHaveTextContent(
            '100 matches of 1k logs'
          );
        });

        it('loaded with top events', () => {
          render(
            <ConfidenceFooter
              rawLogCounts={rawLogCounts}
              chartInfo={chartInfo({sampleCount: 100, isSampled: false, topEvents: 5})}
              hasUserQuery
              isLoading={false}
            />,
            {
              wrapper: Wrapper,
            }
          );
          expect(screen.getByTestId('wrapper')).toHaveTextContent(
            '100 matches of 1k logs for top 5 groups'
          );
        });
      });
    });

    describe('sampled', () => {
      describe('without user query', () => {
        describe('partial scan', () => {
          it('loaded 1', async () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 1,
                  isSampled: true,
                  dataScanned: 'partial',
                })}
                hasUserQuery={false}
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 1 sample of 1k logs'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '1 sample')
            );
            expect(
              await screen.findByText(
                /The volume of logs in this time range is too large for us to do a full scan./
              )
            ).toBeInTheDocument();
            expect(
              await screen.findByText(
                /Try reducing the date range or number of projects to attempt scanning all logs./
              )
            ).toBeInTheDocument();
          });

          it('loaded 1 with grouping', async () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 1,
                  isSampled: true,
                  dataScanned: 'partial',
                  topEvents: 5,
                })}
                hasUserQuery={false}
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 1 sample of 1k logs'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '1 sample')
            );
            expect(
              await screen.findByText(
                /The volume of logs in this time range is too large for us to do a full scan./
              )
            ).toBeInTheDocument();
            expect(
              await screen.findByText(
                /Try reducing the date range or number of projects to attempt scanning all logs./
              )
            ).toBeInTheDocument();
          });

          it('loaded 10', async () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 10,
                  isSampled: true,
                  dataScanned: 'partial',
                })}
                hasUserQuery={false}
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 10 samples of 1k logs'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '10 samples')
            );
            expect(
              await screen.findByText(
                /The volume of logs in this time range is too large for us to do a full scan./
              )
            ).toBeInTheDocument();
            expect(
              await screen.findByText(
                /Try reducing the date range or number of projects to attempt scanning all logs./
              )
            ).toBeInTheDocument();
          });

          it('loaded 10 with grouping', async () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 10,
                  isSampled: true,
                  dataScanned: 'partial',
                  topEvents: 5,
                })}
                hasUserQuery={false}
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 10 samples of 1k logs'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '10 samples')
            );
            expect(
              await screen.findByText(
                /The volume of logs in this time range is too large for us to do a full scan./
              )
            ).toBeInTheDocument();
            expect(
              await screen.findByText(
                /Try reducing the date range or number of projects to attempt scanning all logs./
              )
            ).toBeInTheDocument();
          });
        });

        describe('full scan', () => {
          it('loaded 1', () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 1,
                  isSampled: true,
                  dataScanned: 'full',
                })}
                hasUserQuery={false}
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 1 log'
            );
          });

          it('loaded 1 with grouping', () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 1,
                  isSampled: true,
                  dataScanned: 'full',
                  topEvents: 5,
                })}
                hasUserQuery={false}
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 1 log'
            );
          });

          it('loaded 10', () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 10,
                  isSampled: true,
                  dataScanned: 'full',
                })}
                hasUserQuery={false}
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 10 logs'
            );
          });

          it('loaded 10 with grouping', () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 10,
                  isSampled: true,
                  dataScanned: 'full',
                  topEvents: 5,
                })}
                hasUserQuery={false}
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 10 logs'
            );
          });
        });
      });

      describe('with user query', () => {
        describe('partial scan', () => {
          it('loaded 1', async () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 1,
                  isSampled: true,
                  dataScanned: 'partial',
                })}
                hasUserQuery
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 1 match after scanning 100 samples of 1k logs'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '1 match')
            );
            expect(
              await screen.findByText(
                /The volume of logs in this time range is too large for us to do a full scan./
              )
            ).toBeInTheDocument();
            expect(
              await screen.findByText(
                /Try reducing the date range or number of projects to attempt scanning all logs./
              )
            ).toBeInTheDocument();
          });

          it('loaded 1 with grouping', async () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 1,
                  isSampled: true,
                  dataScanned: 'partial',
                  topEvents: 5,
                })}
                hasUserQuery
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 1 match after scanning 100 samples of 1k logs'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '1 match')
            );
            expect(
              await screen.findByText(
                /The volume of logs in this time range is too large for us to do a full scan./
              )
            ).toBeInTheDocument();
            expect(
              await screen.findByText(
                /Try reducing the date range or number of projects to attempt scanning all logs./
              )
            ).toBeInTheDocument();
          });

          it('loaded 10', async () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 10,
                  isSampled: true,
                  dataScanned: 'partial',
                })}
                hasUserQuery
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 10 matches after scanning 100 samples of 1k logs'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '10 matches')
            );
            expect(
              await screen.findByText(
                /The volume of logs in this time range is too large for us to do a full scan./
              )
            ).toBeInTheDocument();
            expect(
              await screen.findByText(
                /Try reducing the date range or number of projects to attempt scanning all logs./
              )
            ).toBeInTheDocument();
          });

          it('loaded 10 with grouping', async () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 10,
                  isSampled: true,
                  dataScanned: 'partial',
                  topEvents: 5,
                })}
                hasUserQuery
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 10 matches after scanning 100 samples of 1k logs'
            );
            await userEvent.hover(
              screen.getByText((_, element) => element?.textContent === '10 matches')
            );
            expect(
              await screen.findByText(
                /The volume of logs in this time range is too large for us to do a full scan./
              )
            ).toBeInTheDocument();
            expect(
              await screen.findByText(
                /Try reducing the date range or number of projects to attempt scanning all logs./
              )
            ).toBeInTheDocument();
          });
        });

        describe('full scan', () => {
          it('loaded 1', () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 1,
                  isSampled: true,
                  dataScanned: 'full',
                })}
                hasUserQuery={false}
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 1 log'
            );
          });

          it('loaded 1 with grouping', () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 1,
                  isSampled: true,
                  dataScanned: 'full',
                  topEvents: 5,
                })}
                hasUserQuery={false}
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 1 log'
            );
          });

          it('loaded 10', () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 10,
                  isSampled: true,
                  dataScanned: 'full',
                })}
                hasUserQuery={false}
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated from 10 logs'
            );
          });

          it('loaded 10 with grouping', () => {
            render(
              <ConfidenceFooter
                rawLogCounts={rawLogCounts}
                chartInfo={chartInfo({
                  sampleCount: 10,
                  isSampled: true,
                  dataScanned: 'full',
                  topEvents: 5,
                })}
                hasUserQuery={false}
                isLoading={false}
              />,
              {
                wrapper: Wrapper,
              }
            );
            expect(screen.getByTestId('wrapper')).toHaveTextContent(
              'Estimated for top 5 groups from 10 logs'
            );
          });
        });
      });
    });
  });
});
